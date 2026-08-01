import 'dotenv/config';
import assert from 'node:assert/strict';
import { rmdir, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const api = process.env.TEST_API_URL ?? 'http://127.0.0.1:3001';
const prisma = new PrismaClient();
const queue = new Queue('generation', { connection: { host: '127.0.0.1', port: 6379 } });
const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const password = 'AlunaTest2026!';
const emails = {
  admin: `verify-admin-${stamp}@aluna.test`,
  creator: `verify-creator-${stamp}@aluna.test`,
  viewer: `verify-viewer-${stamp}@aluna.test`,
};
const waitlistPhone = `+2126${String(Date.now()).slice(-8)}`;
const temporaryUserIds = [];
let generationId;
let inputKey;
let runtimeConfig;
let passed = 0;

function check(condition, label) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}  ${label}`);
}

async function json(path, init = {}) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

function authorized(token, init = {}) {
  return { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } };
}

async function login(email, value = password) {
  return json('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: value }),
  });
}

async function createUser(token, role) {
  const email = emails[role.toLowerCase()];
  const result = await json(
    '/users',
    authorized(token, {
      method: 'POST',
      body: JSON.stringify({ name: `Verify ${role}`, email, password, role }),
    }),
  );
  check(result.response.status === 201, `${role.toLowerCase()} account can be created by owner`);
  temporaryUserIds.push(result.body.id);
  return result.body;
}

async function waitForFinalGeneration(token) {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    const job = await queue.getJob(generationId);
    const state = job ? await job.getState() : 'missing';
    if (state === 'failed') {
      const run = await json(`/generations/${generationId}`, authorized(token));
      return run.body;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  }
  throw new Error('Generation job did not reach its final state within 40 seconds');
}

try {
  const health = await fetch(`${api}/waitlist`, { method: 'OPTIONS' });
  check(health.status !== 0, 'API is reachable');

  let result = await json('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'demo@aluna.studio', password: 'wrong-password' }),
  });
  check(
    result.response.status === 400 || result.response.status === 401,
    'invalid credentials are rejected',
  );

  const ownerLogin = await login('demo@aluna.studio', 'AlunaDemo2026!');
  check(
    ownerLogin.response.status === 200 && ownerLogin.body.user.role === 'OWNER',
    'demo owner can authenticate',
  );
  const ownerToken = ownerLogin.body.accessToken;

  result = await json('/auth/me', authorized(ownerToken));
  check(
    result.response.status === 200 && result.body.permissions.includes('analytics:read'),
    'owner identity includes analytics permission',
  );

  result = await json('/generations');
  check(result.response.status === 401, 'protected generation ledger rejects anonymous access');

  result = await json('/generations/presets', authorized(ownerToken));
  check(
    result.response.status === 200 && result.body.length === 6,
    'all six product categories are available',
  );
  check(
    result.body.every((category) => category.scenes.length === 3),
    'every category exposes three thoughtful scenes',
  );
  result = await json('/generations/configuration', authorized(ownerToken));
  runtimeConfig = result.body;
  check(
    result.response.status === 200 && ['cloudflare', 'openai'].includes(runtimeConfig.provider),
    'generation provider configuration is exposed without secrets',
  );
  check(
    runtimeConfig.model && Array.isArray(runtimeConfig.missingConfiguration),
    'generation provider readiness and model are reported',
  );

  result = await json('/admin/overview?days=30', authorized(ownerToken));
  check(
    result.response.status === 200 && result.body.summary && result.body.queue,
    'admin overview returns live analytics and queue health',
  );

  result = await json('/admin/overview?days=13', authorized(ownerToken));
  check(result.response.status === 400, 'analytics range validation rejects unsupported periods');

  result = await json('/waitlist', {
    method: 'POST',
    body: JSON.stringify({ phone: waitlistPhone, locale: 'fr', source: 'system-test' }),
  });
  check(
    result.response.status === 200 && result.body.status === 'subscribed',
    'waitlist accepts a valid subscriber',
  );
  result = await json('/waitlist', {
    method: 'POST',
    body: JSON.stringify({ phone: waitlistPhone, locale: 'en', source: 'system-test' }),
  });
  check(result.response.status === 200, 'waitlist subscription is idempotent');
  result = await json('/waitlist', { method: 'POST', body: JSON.stringify({ phone: 'invalid' }) });
  check(result.response.status === 400, 'waitlist phone validation works');

  const admin = await createUser(ownerToken, 'ADMIN');
  const creator = await createUser(ownerToken, 'CREATOR');
  const viewer = await createUser(ownerToken, 'VIEWER');

  result = await json(
    '/users',
    authorized(ownerToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate', email: emails.viewer, password, role: 'VIEWER' }),
    }),
  );
  check(result.response.status === 409, 'duplicate user email is rejected');
  result = await json(
    '/users',
    authorized(ownerToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weak',
        email: `weak-${stamp}@aluna.test`,
        password: 'short',
        role: 'VIEWER',
      }),
    }),
  );
  check(result.response.status === 400, 'weak user password is rejected');

  const [adminLogin, creatorLogin, viewerLogin] = await Promise.all([
    login(emails.admin),
    login(emails.creator),
    login(emails.viewer),
  ]);
  check(adminLogin.response.status === 200, 'admin can authenticate');
  check(creatorLogin.response.status === 200, 'creator can authenticate');
  check(viewerLogin.response.status === 200, 'viewer can authenticate');

  result = await json('/admin/overview?days=7', authorized(viewerLogin.body.accessToken));
  check(result.response.status === 403, 'viewer cannot access admin analytics');
  result = await json('/admin/overview?days=7', authorized(creatorLogin.body.accessToken));
  check(result.response.status === 403, 'creator cannot access admin analytics');
  result = await json('/admin/overview?days=7', authorized(adminLogin.body.accessToken));
  check(result.response.status === 200, 'admin can access analytics');

  result = await json(
    '/users',
    authorized(creatorLogin.body.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Forbidden',
        email: `forbidden-${stamp}@aluna.test`,
        password,
        role: 'VIEWER',
      }),
    }),
  );
  check(result.response.status === 403, 'creator cannot create users');

  result = await fetch(
    `${api}/generations`,
    authorized(viewerLogin.body.accessToken, { method: 'POST', body: new FormData() }),
  );
  check(result.status === 403, 'viewer cannot enqueue image generation');
  result = await fetch(
    `${api}/generations`,
    authorized(creatorLogin.body.accessToken, { method: 'POST', body: new FormData() }),
  );
  check(result.status === 400, 'creator request requires an image upload');

  result = await json(
    `/generations/${crypto.randomUUID()}`,
    authorized(creatorLogin.body.accessToken),
  );
  check(result.response.status === 404, 'unknown generation is not exposed');

  const refreshed = await json('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: ownerLogin.body.refreshToken }),
  });
  check(refreshed.response.status === 200, 'refresh token rotates successfully');
  result = await json('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: ownerLogin.body.refreshToken }),
  });
  check(result.response.status === 401, 'rotated refresh token cannot be reused');
  result = await json('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshed.body.refreshToken }),
  });
  check(result.response.status === 204, 'logout revokes the active session');
  result = await json('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshed.body.refreshToken }),
  });
  check(result.response.status === 401, 'logged-out refresh token is rejected');

  const activeOwners = await prisma.user.count({ where: { role: 'OWNER', isActive: true } });
  if (activeOwners === 1) {
    result = await json(
      `/users/${ownerLogin.body.user.id}/status`,
      authorized(ownerToken, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }),
    );
    check(result.response.status === 400, 'last active owner cannot be suspended');
  }

  result = await json(
    `/users/${viewer.id}/role`,
    authorized(adminLogin.body.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'CREATOR' }),
    }),
  );
  check(
    result.response.status === 200 && result.body.role === 'CREATOR',
    'admin can change a user role',
  );
  result = await json(
    `/users/${viewer.id}/status`,
    authorized(adminLogin.body.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    }),
  );
  check(result.response.status === 200 && !result.body.isActive, 'admin can suspend a user');
  result = await login(emails.viewer);
  check(result.response.status === 401, 'suspended user cannot authenticate');
  result = await json(
    `/users/${viewer.id}/status`,
    authorized(adminLogin.body.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    }),
  );
  check(result.response.status === 200 && result.body.isActive, 'admin can restore a user');

  // Deliberately malformed image bytes exercise the complete queue failure path without
  // consuming provider credits during routine verification.
  const png = Buffer.from('not-a-real-image');
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'verify-product.png');
  form.append('category', 'clothing');
  form.append('sceneId', 'studio');
  form.append('variants', '1');
  const queued = await fetch(
    `${api}/generations`,
    authorized(creatorLogin.body.accessToken, { method: 'POST', body: form }),
  );
  const queuedBody = await queued.json();
  check(
    queued.status === 201 && queuedBody.status === 'queued',
    'creator can enqueue a valid multipart generation',
  );
  generationId = queuedBody.id;
  const failedRun = await waitForFinalGeneration(creatorLogin.body.accessToken);
  inputKey = (
    await prisma.generation.findUnique({ where: { id: generationId }, select: { inputKey: true } })
  )?.inputKey;
  check(failedRun.status === 'failed', 'image processing failure reaches a final failed state');
  check(
    !failedRun.error?.includes('sharp_1.default'),
    'Sharp image preprocessing is loaded through its CommonJS export',
  );
  check(
    failedRun.errorCode === 'provider_error',
    'pre-provider image failure is classified for the dashboard',
  );
  check(
    failedRun.model === runtimeConfig.model && failedRun.requestedVariants === 1,
    'selected provider model and requested consumption are persisted',
  );

  result = await json('/admin/overview?days=7', authorized(adminLogin.body.accessToken));
  check(
    result.response.status === 200 &&
      result.body.recentGenerations.some((run) => run.id === generationId),
    'failed request appears in admin analytics',
  );

  console.log(`\nSystem verification complete: ${passed} checks passed.`);
} finally {
  if (generationId) {
    const job = await queue.getJob(generationId).catch(() => undefined);
    if (job) await job.remove().catch(() => undefined);
  }
  if (temporaryUserIds.length) {
    await prisma.refreshSession.deleteMany({ where: { userId: { in: temporaryUserIds } } });
    await prisma.generation.deleteMany({ where: { userId: { in: temporaryUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: temporaryUserIds } } });
  }
  await prisma.waitlistSubscriber.deleteMany({ where: { phone: waitlistPhone } });
  if (generationId) await prisma.generation.deleteMany({ where: { id: generationId } });
  if (inputKey && inputKey.includes(generationId)) {
    const outputRoot = resolve('output');
    const inputPath = resolve(outputRoot, inputKey);
    if (inputPath.startsWith(outputRoot)) {
      await unlink(inputPath).catch(() => undefined);
      await rmdir(dirname(inputPath)).catch(() => undefined);
    }
  }
  await queue.close();
  await prisma.$disconnect();
}
