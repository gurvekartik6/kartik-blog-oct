
import dns from 'node:dns';

import { Worker } from 'bullmq';

import { env } from '../../api/src/config/env.js';
import {
  connectDatabase,
  disconnectDatabase
} from '../../api/src/db.js';

import { redisConnection } from '../../api/src/services/queue.js';

import {
  Post,
  Subscriber,
  NewsletterCampaign,
  NewsletterDelivery
} from '../../api/src/models/index.js';

import {
  sendEmail,
  escapeHtml
} from '../../api/src/services/email.js';

import {
  unsubscribeTokenForEmail
} from '../../api/src/services/tokens.js';

// Development workaround for the DNS issue on this Windows machine.
// Must be applied before connecting to MongoDB.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const QUEUE_NAME = 'newsletter';
const MAX_ERROR_LENGTH = 500;

let worker;
let shuttingDown = false;

async function processNewsletterJob(job) {
  if (job.name !== 'announce-post') {
    throw new Error(`Unsupported newsletter job: ${job.name}`);
  }

  const { campaignId, postId } = job.data;

  const campaign = await NewsletterCampaign.findById(campaignId);

  if (!campaign) {
    throw new Error(`Newsletter campaign not found: ${campaignId}`);
  }

  const post = await Post.findById(postId);

  if (!post) {
    throw new Error(`Newsletter post not found: ${postId}`);
  }

  if (post.status !== 'published') {
    throw new Error('The post must be published before sending a newsletter.');
  }

  campaign.status = 'processing';
  campaign.startedAt = campaign.startedAt || new Date();
  await campaign.save();

  // Snapshot confirmed subscribers only once for this campaign.
  // The unique campaign/subscriber index prevents duplicate records.
  const existingCount = await NewsletterDelivery.countDocuments({
    campaign: campaign._id
  });

  if (existingCount === 0) {
    const subscribers = await Subscriber.find({
      status: 'confirmed'
    })
      .select('email')
      .lean();

    if (subscribers.length > 0) {
      try {
        await NewsletterDelivery.insertMany(
          subscribers.map((subscriber) => ({
            campaign: campaign._id,
            subscriber: subscriber._id,
            email: subscriber.email,
            status: 'queued'
          })),
          { ordered: false }
        );
      } catch (error) {
        // Duplicate-key errors can occur if a job is delivered twice.
        // Other insertion errors must still fail the job.
        if (
          error.code !== 11000 &&
          !error.writeErrors?.every(
            (item) => item.code === 11000
          )
        ) {
          throw error;
        }
      }
    }
  }

  campaign.recipientCount =
    await NewsletterDelivery.countDocuments({
      campaign: campaign._id
    });

  await campaign.save();

  const pendingDeliveries = await NewsletterDelivery.find({
    campaign: campaign._id,
    status: { $in: ['queued', 'failed'] }
  })
    .sort({ createdAt: 1 })
    .lean();

  let failuresThisAttempt = 0;

  for (const item of pendingDeliveries) {
    let delivery;

    try {
      delivery = await NewsletterDelivery.findById(item._id);

      if (
        !delivery ||
        delivery.status === 'sent' ||
        delivery.status === 'suppressed'
      ) {
        continue;
      }

      // Recheck consent immediately before sending.
      const subscriber = await Subscriber.findOne({
        _id: delivery.subscriber,
        status: 'confirmed'
      })
        .select('email +unsubscribeSecret')
        .lean();

      if (!subscriber) {
        delivery.status = 'suppressed';
        delivery.lastError =
          'Subscriber was no longer confirmed before delivery.';

        await delivery.save();
        continue;
      }

      delivery.email = subscriber.email;
      delivery.status = 'queued';
      delivery.attempts += 1;
      delivery.lastError = '';

      await delivery.save();

      const articleUrl =
        `${env.CLIENT_URL.replace(/\/+$/, '')}/blog/${post.slug}`;

      const token = unsubscribeTokenForEmail(
        subscriber.email,
        subscriber.unsubscribeSecret || ''
      );

      const unsubscribeUrl =
        `${env.API_URL.replace(/\/+$/, '')}` +
        `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

      const safeTitle = escapeHtml(post.title);
      const safeExcerpt = escapeHtml(post.excerpt || '');

      const result = await sendEmail({
        to: subscriber.email,
        subject: post.title,

        html: `
          <main style="font:16px/1.6 system-ui;max-width:620px;margin:auto">
            <p>FIELD NOTES · NEW STORY</p>
            <h1>${safeTitle}</h1>
            <p>${safeExcerpt}</p>
            <p><a href="${articleUrl}">Read the story</a></p>
            <hr />
            <p style="font-size:12px;color:#777">
              You are receiving this because you subscribed to Field Notes.
              <a href="${unsubscribeUrl}">Unsubscribe</a>.
            </p>
          </main>
        `,

        text:
          `${post.title}\n\n` +
          `${post.excerpt || ''}\n\n` +
          `Read: ${articleUrl}\n` +
          `Unsubscribe: ${unsubscribeUrl}`
      });

      delivery.status = 'sent';
      delivery.providerMessageId = result?.id || '';
      delivery.sentAt = new Date();
      delivery.lastError = '';

      await delivery.save();
    } catch (error) {
      failuresThisAttempt += 1;

      if (delivery) {
        delivery.status = 'failed';
        delivery.lastError = String(
          error.message || 'Email delivery failed'
        ).slice(0, MAX_ERROR_LENGTH);

        await delivery.save().catch((saveError) => {
          console.error(
            'Could not save newsletter delivery failure:',
            saveError.message
          );
        });
      }

      console.error(
        'Newsletter delivery failed:',
        delivery?.email || item.email,
        error.message
      );
    }
  }

  const [sentCount, failedCount, queuedCount] = await Promise.all([
    NewsletterDelivery.countDocuments({
      campaign: campaign._id,
      status: 'sent'
    }),

    NewsletterDelivery.countDocuments({
      campaign: campaign._id,
      status: 'failed'
    }),

    NewsletterDelivery.countDocuments({
      campaign: campaign._id,
      status: 'queued'
    })
  ]);

  campaign.sentCount = sentCount;
  campaign.failedCount = failedCount + queuedCount;

  if (campaign.failedCount > 0) {
    campaign.status = 'processing';
  } else {
    campaign.status = 'completed';
    campaign.completedAt = new Date();
  }

  await campaign.save();

  // BullMQ retries the job according to its configured retry policy.
  // Already-sent delivery records are skipped on the next attempt.
  if (failuresThisAttempt > 0 || campaign.failedCount > 0) {
    throw new Error(
      `${campaign.failedCount} newsletter delivery(s) remain unsuccessful.`
    );
  }

  console.log(
    `Campaign ${campaign._id} completed: ` +
    `${sentCount}/${campaign.recipientCount} sent.`
  );

  return {
    campaignId: String(campaign._id),
    recipientCount: campaign.recipientCount,
    sentCount,
    failedCount: campaign.failedCount
  };
}

async function startWorker() {
  await connectDatabase();

  console.log('Newsletter worker connected to MongoDB.');

  worker = new Worker(
    QUEUE_NAME,
    processNewsletterJob,
    {
      connection: redisConnection,
      concurrency: 2
    }
  );

  worker.on('completed', (job) => {
    console.log(`Newsletter job completed: ${job.id}`);
  });

  worker.on('failed', async (job, error) => {
    console.error(
      `Newsletter job failed: ${job?.id || 'unknown'}`,
      error.message
    );

    if (
      job?.data?.campaignId &&
      job.attemptsMade >= (job.opts.attempts || 5)
    ) {
      await NewsletterCampaign.findByIdAndUpdate(
        job.data.campaignId,
        {
          status: 'failed',
          completedAt: new Date()
        }
      ).catch((updateError) => {
        console.error(
          'Could not update failed campaign:',
          updateError.message
        );
      });
    }
  });

  worker.on('error', (error) => {
    console.error('Newsletter worker error:', error.message);
  });

  console.log('Newsletter worker started.');
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received; stopping newsletter worker.`);

  try {
    if (worker) {
      await worker.close();
    }

    await disconnectDatabase();

    console.log('Newsletter worker stopped.');
  } catch (error) {
    console.error('Worker shutdown failed:', error.message);
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await startWorker();
} catch (error) {
  console.error('Could not start newsletter worker:', error.message);

  await disconnectDatabase().catch(() => {});

  process.exitCode = 1;
}
