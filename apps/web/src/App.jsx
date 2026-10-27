import { useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams
} from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Heart,
  Menu,
  Moon,
  Sun,
  X
} from 'lucide-react'
import { useTheme } from './theme/ThemeProvider.jsx'
import { apiRequest } from './lib/api.js'
import Admin from './Admin.jsx'
import DOMPurify from 'dompurify'

function usePageMeta (title, description, canonicalPath, canonicalUrl) {
  useEffect(() => {
    if (title) document.title = `${title} · Field Notes`
    if (description) {
      let meta = document.querySelector('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = description
    }
    if (canonicalPath) {
      let canonical = document.querySelector('link[rel="canonical"]')
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
      }
      canonical.href =
        typeof canonicalUrl === 'string' && /^https?:\/\//i.test(canonicalUrl)
          ? canonicalUrl
          : `${window.location.origin}${canonicalPath}`
    }
  }, [title, description, canonicalPath, canonicalUrl])
}

const fallbackPosts = [
  {
    _id: 'story-1',
    title: 'How to reason about time and space complexity',
    slug: 'reasoning-about-complexity',
    category: 'Algorithms',
    excerpt:
      'A practical way to analyze growth rates, compare approaches, and explain the trade-offs behind an implementation.',
    readTime: 8,
    publishedAt: '2026-10-12',
    coverImage: ''
  },
  {
    _id: 'story-2',
    title: 'What actually happens when an API request arrives?',
    slug: 'inside-an-api-request',
    category: 'Backend engineering',
    excerpt:
      'Follow a request through routing, validation, business logic, persistence, and the response sent back to a client.',
    readTime: 10,
    publishedAt: '2026-09-28',
    coverImage: ''
  },
  {
    _id: 'story-3',
    title: 'Connecting neural networks with symbolic reasoning',
    slug: 'neural-symbolic-reasoning',
    category: 'AI / ML',
    excerpt:
      'A concise introduction to combining learned representations with explicit rules, constraints, and structured knowledge.',
    readTime: 12,
    publishedAt: '2026-09-14',
    coverImage: ''
  }
]

function useSiteData () {
  const [posts, setPosts] = useState(fallbackPosts)
  const [settings, setSettings] = useState({
    siteName: 'Field Notes',
    tagline: 'SOFTWARE · SYSTEMS · RESEARCH',
    homeTitle: 'Notes on code, systems, and the ideas behind them.',
    homeSubtitle:
      'Technical write-ups, implementation notes, and research explorations from a computer science engineer.'
  })
  useEffect(() => {
    apiRequest('/api/posts?limit=6')
      .then(data => setPosts(data.items || []))
      .catch(() => {})
    apiRequest('/api/site')
      .then(data => setSettings(current => ({ ...current, ...data.settings })))
      .catch(() => {})
  }, [])
  useEffect(() => {
    const accent = settings.theme?.accent
    if (typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent))
      document.documentElement.style.setProperty('--accent', accent)
    else document.documentElement.style.removeProperty('--accent')
  }, [settings.theme?.accent])
  return { posts, settings }
}

function Header ({ settings }) {
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const fallbackNavigation = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Writing', href: '/blog' },
    { label: 'Journey', href: '/journey' },
    { label: 'Contact', href: '/contact' }
  ]
  const navigation = Array.isArray(settings.navigation)
    ? settings.navigation.filter(
        item =>
          item &&
          typeof item.label === 'string' &&
          typeof item.href === 'string' &&
          item.href.startsWith('/') &&
          !item.href.startsWith('//')
      )
    : fallbackNavigation
  const visibleNavigation = navigation.length ? navigation : fallbackNavigation
  return (
    <header className='site-header'>
      <div className='header-inner'>
        <Link to='/' className='brand' onClick={() => setOpen(false)}>
          {/* <span className='brand-mark'>.dev</span> */}
          <span>
            {settings.siteName || 'Developer Blog'}
            <small>{settings.tagline || 'Sharing Experience'}</small>
          </span>
        </Link>
        <button
          className='mobile-menu icon-button'
          aria-label='Toggle navigation'
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={open ? 'nav nav-open' : 'nav'}>
          {visibleNavigation.map(item => (
            <NavLink
              key={`${item.label}-${item.href}`}
              to={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            className='theme-toggle icon-button'
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  )
}

function Footer ({ settings }) {
  const [email, setEmail] = useState('')
  const socialLinks = Array.isArray(settings.socialLinks)
    ? settings.socialLinks.filter(
        item =>
          item &&
          typeof item.label === 'string' &&
          typeof item.url === 'string' &&
          /^https?:\/\//i.test(item.url)
      )
    : []
  const [status, setStatus] = useState('')
  async function subscribe (event) {
    event.preventDefault()
    setStatus('')
    try {
      const result = await apiRequest('/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      setStatus(
        result.message || 'Check your inbox to confirm your subscription.'
      )
      setEmail('')
    } catch (error) {
      setStatus(error.message)
    }
  }
  return (
    <footer className='footer'>
      <div className='footer-top'>
        <div>
          <span className='eyebrow'>
            {settings.newsletterEyebrow || 'THE OCCASIONAL LETTER'}
          </span>
          <h2>
            {settings.newsletterHeading || (
              <>
                Good notes.
                <br />
                <em>Worth keeping.</em>
              </>
            )}
          </h2>
          <p>
            {settings.newsletterDescription ||
              'New stories and useful lessons, delivered when there is something worth sharing.'}
          </p>
        </div>
        <form className='subscribe-form' onSubmit={subscribe}>
          <label htmlFor='subscriber-email'>Your email address</label>
          <div className='subscribe-row'>
            <input
              id='subscriber-email'
              type='email'
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='you@example.com'
            />
            <button className='button button-dark' type='submit'>
              Subscribe <ArrowRight size={16} />
            </button>
          </div>
          <small>{status || 'No noise. Unsubscribe whenever you like.'}</small>
        </form>
      </div>
      <div className='footer-bottom'>
        <span>
          © {new Date().getFullYear()} {settings.siteName || 'Field Notes'}
        </span>
        <span>
          {settings.footerText || 'Made slowly, learned along the way.'}
        </span>
        {socialLinks.map(item => (
          <a
            key={`${item.label}-${item.url}`}
            href={item.url}
            target='_blank'
            rel='noreferrer'
          >
            {item.label}
          </a>
        ))}
      </div>
    </footer>
  )
}

function SectionHeading ({ eyebrow, title, link, to = '/blog' }) {
  return (
    <div className='section-heading'>
      <div>
        <span className='eyebrow'>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {link && (
        <Link className='text-link' to={to}>
          {link} <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  )
}

function PostCard ({ post, index = 0 }) {
  return (
    <article
      className={`post-card post-card-${index % 3}${
        post.coverImage ? ' has-cover' : ''
      }`}
    >
      <div className='post-card-copy'>
        <div className='post-meta'>
          <span>{post.category || 'Engineering notes'}</span>
          <span>{post.readTime || 5} min read</span>
        </div>
        <h3>
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p>{post.excerpt || ''}</p>
        <Link className='read-link' to={`/blog/${post.slug}`}>
          Read article <ArrowUpRight size={15} />
        </Link>
      </div>
      {post.coverImage && (
        <Link
          className='post-art'
          to={`/blog/${post.slug}`}
          aria-label={`Read ${post.title}`}
        >
          <img src={post.coverImage} alt={post.coverAlt || ''} loading='lazy' />
        </Link>
      )}
    </article>
  )
}

function Home ({ posts, settings }) {
  usePageMeta(
    settings.siteName || 'Personal engineering journal',
    settings.homeSubtitle ||
      'Technical write-ups, implementation notes, and research explorations from a computer science engineer.',
    '/'
  )
  const visible = posts.slice(0, 3)
  return (
    <>
      <section className='hero container'>
        <div className='hero-copy'>
          <span className='eyebrow'>
            <span className='status-dot' />{' '}
            {settings.tagline || 'SOFTWARE · SYSTEMS · RESEARCH'}
          </span>
          <h1>
            {(
              settings.homeTitle ||
              'Notes on code, systems, and the ideas behind them.'
            )
              .split('\\n')
              .map((line, i) => (
                <span key={i}>
                  {line}
                  {i === 0 && (settings.homeTitle || '').includes('\\n') ? (
                    <br />
                  ) : (
                    ' '
                  )}
                </span>
              ))}
          </h1>
          <p className='hero-subtitle'>{settings.homeSubtitle}</p>
          <div className='hero-actions'>
            <Link className='button button-dark' to='/blog'>
              Browse articles <ArrowRight size={16} />
            </Link>
            <Link className='button button-quiet' to='/about'>
              About this journal <ArrowDownRight size={16} />
            </Link>
          </div>
          <div className='hero-note'>
            <span className='note-line' />
            <span>Understand deeply. Explain clearly. Build carefully.</span>
          </div>
        </div>
        <div className='hero-visual'>
          {settings.heroImage ? (
            <div className='hero-image-frame'>
              <img
                className='hero-custom-image'
                src={settings.heroImage}
                alt={settings.heroImageAlt || ''}
              />
            </div>
          ) : (
            <div className='terminal-card' aria-label='Example code snippet'>
              <div className='terminal-topbar'>
                <span className='terminal-lights'>
                  <i />
                  <i />
                  <i />
                </span>
                <span>notes.ts</span>
                <span className='terminal-language'>TYPESCRIPT</span>
              </div>
              <pre className='terminal-code'>
                <code>
                  <span className='code-line'>
                    <i>01</i>
                    <b>const</b> idea = <em>"understand it"</em>;
                  </span>
                  <span className='code-line'>
                    <i>02</i>
                    <b>const</b> build = (idea) =&gt; {`{`}
                  </span>
                  <span className='code-line'>
                    <i>03</i> <b>return</b> test(idea);
                  </span>
                  <span className='code-line'>
                    <i>04</i>
                    {`}`};
                  </span>
                  <span className='code-line code-line-muted'>
                    <i>05</i>
                    <b>while</b> (curious) {'{'} learn(); {'}'}
                  </span>
                </code>
              </pre>
              <div className='terminal-footer'>
                <span>
                  <span className='terminal-status-dot' /> All systems curious
                </span>
                <span>main · 0 errors</span>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className='intro-band'>
        <div className='container intro-inner'>
          <span className='eyebrow'>
            {settings.introEyebrow || 'THE ENGINEERING NOTEBOOK'}
          </span>
          <p>
            {settings.introText || (
              <>
                Writing is a way to make ideas precise: explore the{' '}
                <em>why behind the code</em>, document the trade-offs, and leave
                a useful trail for the next person.
              </>
            )}
          </p>
          <Link to='/about' className='round-link' aria-label='Read about me'>
            <ArrowUpRight />
          </Link>
        </div>
      </section>
      <section className='container section-block'>
        <SectionHeading
          eyebrow={settings.postsEyebrow || 'LATEST NOTES'}
          title={settings.postsHeading || 'Recently published'}
          link={settings.postsLinkText || 'All writing'}
        />
        <div className='post-grid'>
          {visible.map((post, i) => (
            <PostCard key={post._id || post.slug} post={post} index={i} />
          ))}
        </div>
      </section>
      <section className='journey-teaser'>
        <div className='container journey-inner'>
          <div>
            <span className='eyebrow'>
              {settings.journeyEyebrow || 'HOW I APPROACH ENGINEERING'}
            </span>
            <h2>
              {settings.journeyHeading || (
                <>
                  Understand the system.
                  <br />
                  Then <em>write it down.</em>
                </>
              )}
            </h2>
          </div>
          <div className='journey-description'>
            <p>
              {settings.journeyDescription ||
                'I use these notes to work through algorithms, backend systems, AI research, and the implementation details that are easy to skip but important to understand.'}
            </p>
            <Link to='/journey' className='text-link'>
              {settings.journeyLinkText || 'About this journal'}{' '}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Blog ({ posts }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(null)
  useEffect(() => {
    apiRequest('/api/pages/blog')
      .then(r => setPage(r.page))
      .catch(() => {})
  }, [])
  const content = page?.content || {}
  usePageMeta(
    page?.seo?.title || page?.title || 'Writing',
    page?.seo?.description ||
      content.intro ||
      'Technical articles on computer science, software engineering, systems, and AI.',
    '/blog',
    page?.seo?.canonicalUrl
  )
  const filtered = posts.filter(p =>
    `${p.title} ${p.excerpt} ${p.category} ${(p.tags || []).join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  return (
    <main className='container page-main'>
      <div className='page-intro'>
        <span className='eyebrow'>
          {content.eyebrow || 'TECHNICAL WRITING'}
        </span>
        <h1>
          {content.headline || 'Concepts, systems, and implementation notes.'}
        </h1>
        <p>
          {content.intro ||
            'Practical explanations and deeper dives into computer science, software engineering, AI/ML, and the trade-offs behind real implementations.'}
        </p>
      </div>
      {content.image && (
        <img
          className='page-feature-image'
          src={content.image}
          alt={content.imageAlt || ''}
        />
      )}
      <div className='search-field'>
        <span>⌕</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={
            content.searchPlaceholder ||
            'Search algorithms, systems, AI, and more…'
          }
        />
      </div>
      {filtered.length ? (
        <div className='post-grid blog-grid'>
          {filtered.map((p, i) => (
            <PostCard key={p._id || p.slug} post={p} index={i} />
          ))}
        </div>
      ) : (
        <div className='empty-state'>
          {content.emptyText || 'No stories match that search yet.'}
        </div>
      )}
    </main>
  )
}

function Article ({ posts }) {
  const { slug } = useParams()
  const [post, setPost] = useState(
    () => posts.find(p => p.slug === slug) || null
  )
  const [notFound, setNotFound] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(0)
  const [comments, setComments] = useState([])
  const [form, setForm] = useState({ name: '', email: '', body: '' })
  const [message, setMessage] = useState('')
  useEffect(() => {
    const existing = posts.find(p => p.slug === slug)
    setNotFound(false)
    if (existing) setPost(existing)
    else setPost(null)
    apiRequest(`/api/posts/${encodeURIComponent(slug)}`)
      .then(data => {
        setPost(data.post)
        setLikes(data.post.likeCount || 0)
        setComments(data.comments || [])
        setLiked(Boolean(data.liked))
        setNotFound(false)
      })
      .catch(() => {
        if (!existing) setNotFound(true)
      })
  }, [slug, posts])
  async function toggleLike () {
    try {
      const data = await apiRequest(`/api/posts/${slug}/like`, {
        method: 'POST',
        body: JSON.stringify({})
      })
      setLiked(data.liked)
      setLikes(data.likeCount)
    } catch (e) {
      setMessage(e.message)
    }
  }
  async function submitComment (e) {
    e.preventDefault()
    try {
      await apiRequest(`/api/posts/${slug}/comments`, {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setMessage('Thanks — your comment is awaiting moderation.')
      setForm({ name: '', email: '', body: '' })
    } catch (err) {
      setMessage(err.message)
    }
  }
  usePageMeta(
    post?.seo?.title || post?.title || 'Story',
    post?.seo?.description || post?.excerpt || '',
    post?.slug ? `/blog/${post.slug}` : undefined,
    post?.seo?.canonicalUrl
  )
  if (!post && notFound)
    return (
      <main className='container page-main'>
        <h1>Story not found.</h1>
        <p>
          This article may have been unpublished or the link may be incorrect.
        </p>
        <Link to='/blog' className='text-link'>
          Return to writing <ArrowRight size={16} />
        </Link>
      </main>
    )
  if (!post)
    return (
      <main className='container page-main'>
        <p>Loading story…</p>
      </main>
    )
  return (
    <main className='container article-main'>
      <Link to='/blog' className='back-link'>
        ← All writing
      </Link>
      <div className='article-heading'>
        <span className='eyebrow'>
          {post.category || 'FIELD NOTES'} · {post.readTime || 5} MIN READ
        </span>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
      </div>
      {post.coverImage && (
        <img
          className='article-cover'
          src={post.coverImage}
          alt={post.coverAlt || ''}
        />
      )}
      <article className='article-content'>
        {typeof post.content === 'string' &&
        post.content.trim().startsWith('<') ? (
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(post.content, {
                USE_PROFILES: { html: true }
              })
            }}
          />
        ) : typeof post.content === 'string' ? (
          <p>{post.content}</p>
        ) : (
          <p>This story is ready for its rich-text content.</p>
        )}
      </article>
      <div className='article-engagement'>
        <button
          className={liked ? 'like-button liked' : 'like-button'}
          onClick={toggleLike}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {likes}{' '}
          appreciations
        </button>
        <span>Thoughts are welcome below.</span>
      </div>
      <section className='comments-section'>
        <span className='eyebrow'>THE CONVERSATION</span>
        <h2>Leave a thoughtful note</h2>
        <form className='comment-form' onSubmit={submitComment}>
          <div className='form-two'>
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Email (not displayed)
              <input
                required
                type='email'
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </label>
          </div>
          <label>
            Your comment
            <textarea
              required
              rows='4'
              maxLength='3000'
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <button className='button button-dark'>
            Submit comment <ArrowRight size={16} />
          </button>
          {message && <p className='form-status'>{message}</p>}
        </form>
        <div className='comment-list'>
          {comments.map(c => (
            <div className='comment' key={c._id}>
              <b>{c.name}</b>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function About () {
  const [page, setPage] = useState(null)
  useEffect(() => {
    apiRequest('/api/pages/about')
      .then(r => setPage(r.page))
      .catch(() => {})
  }, [])
  const content = page?.content || {}
  usePageMeta(
    page?.seo?.title || page?.title || 'About',
    page?.seo?.description ||
      content.description ||
      'The story behind this personal engineering journal.',
    '/about',
    page?.seo?.canonicalUrl
  )
  const body =
    typeof content.body === 'string'
      ? content.body
      : 'This is my working notebook for technical ideas. I write about the reasoning behind implementations, the trade-offs in system design, and the research concepts I am trying to understand well enough to explain clearly.'
  return (
    <main className='container page-main'>
      <div className='page-intro'>
        <span className='eyebrow'>
          {content.eyebrow || 'ABOUT THIS JOURNAL'}
        </span>
        <h1>{content.intro || 'Curiosity deserves a paper trail.'}</h1>
        <p>
          {content.description ||
            "I'm a computer science engineer documenting what I learn about software, algorithms, systems, and AI — with an emphasis on understanding, not just getting code to run."}
        </p>
      </div>
      <div className='about-layout'>
        <div className='about-art'>
          {content.image ? (
            <img
              className='about-feature-image'
              src={content.image}
              alt={content.imageAlt || ''}
            />
          ) : (
            <div className='about-art-inner'>
              <span>IN PROGRESS</span>
              <b>
                Curiosity
                <br />
                over certainty.
              </b>
              <i>✳</i>
            </div>
          )}
        </div>
        <div className='prose'>
          <h2>{content.heading || 'Why I write things down'}</h2>
          <div>
            {body.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <Link to='/contact' className='text-link'>
            Say hello <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </main>
  )
}

function Journey () {
  const [page, setPage] = useState(null)
  useEffect(() => {
    apiRequest('/api/pages/journey')
      .then(r => setPage(r.page))
      .catch(() => {})
  }, [])
  const defaults = [
    [
      '01',
      'Diploma',
      'The first stretch of learning to solve practical problems, work through uncertainty, and build a foundation.'
    ],
    [
      '02',
      'Engineering at SGGS Nanded',
      'Connecting theory with systems, experiments, and the wider world of instrumentation engineering.'
    ],
    [
      '03',
      'Flyrank AI · Machine Learning Intern',
      'Learning how machine-learning ideas move from concepts into applied work.'
    ],
    [
      '04',
      'Mountreach Solutions · Android Intern',
      'Exploring application development and the details behind useful mobile experiences.'
    ],
    [
      '05',
      'Sai Ambrosia · Computer Instructor',
      'Helping others learn technology and discovering how much teaching sharpens understanding.'
    ]
  ]
  usePageMeta(
    page?.seo?.title || page?.title || 'Journey',
    page?.seo?.description ||
      page?.content?.intro ||
      'Education, internships, teaching and milestones along the way.',
    '/journey',
    page?.seo?.canonicalUrl
  )
  const stored = page?.content?.entries
  const steps =
    Array.isArray(stored) && stored.length
      ? stored.map((s, i) => [
          s.number || String(i + 1).padStart(2, '0'),
          s.title || 'Experience',
          s.description || ''
        ])
      : defaults
  return (
    <main className='container page-main'>
      <div className='page-intro'>
        <span className='eyebrow'>
          {page?.content?.eyebrow || 'CHAPTERS SO FAR'}
        </span>
        <h1>{page?.content?.headline || 'A path, not a straight line.'}</h1>
        <p>
          {page?.content?.intro ||
            'Every experience leaves behind a different tool, question, or way of seeing things.'}
        </p>
      </div>
      {page?.content?.image && (
        <img
          className='page-feature-image'
          src={page.content.image}
          alt={page.content.imageAlt || ''}
        />
      )}
      <div className='timeline'>
        {steps.map((s, i) => (
          <div className='timeline-item' key={`${s[0]}-${i}`}>
            <span className='timeline-number'>{s[0]}</span>
            <div>
              <h2>{s[1]}</h2>
              <p>{s[2]}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

function Contact ({ settings }) {
  const [page, setPage] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [status, setStatus] = useState('')
  useEffect(() => {
    apiRequest('/api/pages/contact')
      .then(r => setPage(r.page))
      .catch(() => {})
  }, [])
  const content = page?.content || {}
  usePageMeta(
    page?.seo?.title || page?.title || 'Contact',
    page?.seo?.description ||
      content.description ||
      'Get in touch through the Field Notes contact form.',
    '/contact',
    page?.seo?.canonicalUrl
  )
  async function submit (e) {
    e.preventDefault()
    try {
      const result = await apiRequest('/api/contact', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setStatus(result.message || 'Message sent. Thank you.')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (error) {
      setStatus(error.message)
    }
  }
  return (
    <main className='container page-main contact-layout'>
      <div className='page-intro'>
        <span className='eyebrow'>{content.eyebrow || 'OPEN INBOX'}</span>
        <h1>{content.intro || 'Have a thought? Let’s talk.'}</h1>
        <p>
          {content.description ||
            content.body ||
            'Questions, shared experiences, thoughtful feedback, or just a hello — the form is open.'}
        </p>
      </div>
      {content.image && (
        <img
          className='article-cover'
          src={content.image}
          alt={content.imageAlt || ''}
        />
      )}
      <form className='contact-form' onSubmit={submit}>
        <label>
          Your name
          <input
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Email address
          <input
            type='email'
            required
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Subject
          <input
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
          />
        </label>
        <label>
          Message
          <textarea
            required
            rows='5'
            maxLength='5000'
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
          />
        </label>
        <button className='button button-dark'>
          Send message <ArrowRight size={16} />
        </button>
        {status && <p className='form-status'>{status}</p>}
        {settings.contactEmail && (
          <p className='contact-public-email'>
            Or email{' '}
            <a href={`mailto:${settings.contactEmail}`}>
              {settings.contactEmail}
            </a>
            .
          </p>
        )}
      </form>
    </main>
  )
}

export default function App () {
  const { posts, settings } = useSiteData()
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  return (
    <div className={isAdmin ? 'app-shell admin-route' : 'app-shell'}>
      {!isAdmin && <Header settings={settings} />}
      <Routes>
        <Route path='/' element={<Home posts={posts} settings={settings} />} />
        <Route path='/blog' element={<Blog posts={posts} />} />
        <Route path='/blog/:slug' element={<Article posts={posts} />} />
        <Route path='/about' element={<About />} />
        <Route path='/journey' element={<Journey />} />
        <Route path='/contact' element={<Contact settings={settings} />} />
        <Route path='/admin/*' element={<Admin />} />
        <Route
          path='*'
          element={
            <main className='container page-main'>
              <h1>Page not found.</h1>
              <Link to='/'>Return home</Link>
            </main>
          }
        />
      </Routes>
      {!isAdmin && <Footer settings={settings} />}
    </div>
  )
}
