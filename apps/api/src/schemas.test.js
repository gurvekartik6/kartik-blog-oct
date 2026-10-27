import test from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, postSchema, commentSchema, subscribeSchema } from './schemas.js';

test('login schema accepts a valid login request', () => {
  assert.equal(loginSchema.safeParse({ email: 'admin@example.com', password: 'long-enough' }).success, true);
});
test('post schema rejects unsafe slug shape', () => {
  assert.equal(postSchema.safeParse({ title: 'Story', slug: '../unsafe' }).success, false);
});
test('post schema accepts rich-text HTML but rejects object payloads', () => {
  assert.equal(postSchema.safeParse({ title: 'Story', slug: 'story', content: '<p>Body</p>' }).success, true);
  assert.equal(postSchema.safeParse({ title: 'Story', slug: 'story', content: { html: '<script>alert(1)</script>' } }).success, false);
});
test('comment schema validates required fields', () => {
  assert.equal(commentSchema.safeParse({ name: 'Reader', email: 'reader@example.com', body: 'Useful article' }).success, true);
  assert.equal(commentSchema.safeParse({ name: '', email: 'bad', body: 'x' }).success, false);
});
test('newsletter schema requires a valid email', () => {
  assert.equal(subscribeSchema.safeParse({ email: 'reader@example.com' }).success, true);
  assert.equal(subscribeSchema.safeParse({ email: 'nope' }).success, false);
});
