import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpaqueToken, hashToken, visitorHash, unsubscribeTokenForEmail } from './tokens.js';

test('opaque confirmation tokens are random and stored as one-way hashes', () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, hashToken(first.token));
  assert.notEqual(first.hash, first.token);
});

test('visitor hashes are deterministic without storing the raw visitor identifier', () => {
  assert.equal(visitorHash('visitor-123'), visitorHash('visitor-123'));
  assert.notEqual(visitorHash('visitor-123'), 'visitor-123');
});

test('unsubscribe tokens normalize email casing and rotate with the subscription secret', () => {
  assert.equal(unsubscribeTokenForEmail(' Reader@Example.com ', 'nonce-1'), unsubscribeTokenForEmail('reader@example.com', 'nonce-1'));
  assert.notEqual(unsubscribeTokenForEmail('reader@example.com', 'nonce-1'), unsubscribeTokenForEmail('reader@example.com', 'nonce-2'));
});
