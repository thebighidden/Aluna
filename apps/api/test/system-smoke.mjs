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
  userOne: `verify-user-one-${stamp}@aluna.test`,
  userTwo: `verify-user-two-${stamp}@aluna.test`,
};
const waitlistPhone = `+2126${String(Date.now()).slice(-8)}`;
const visitorId = crypto.randomUUID();
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

async function createUser(token, key, name) {
  const email = emails[key];
  const result = await json(
    '/users',
    authorized(token, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  );
  check(
    result.response.status === 201 && result.body.role === 'USER',
    'Super Admin creates a normal Studio user',
  );
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

  const firstAdminLogin = await login('demo@aluna.studio', 'AlunaDemo2026!');
  check(
    firstAdminLogin.response.status === 200 && firstAdminLogin.body.user.role === 'SUPER_ADMIN',
    'the single Super Admin can authenticate',
  );
  const secondAdminLogin = await login('demo@aluna.studio', 'AlunaDemo2026!');
  check(secondAdminLogin.response.status === 200, 'a new login can replace the active session');
  let adminToken = secondAdminLogin.body.accessToken;

  result = await json('/auth/me', authorized(firstAdminLogin.body.accessToken));
  check(result.response.status === 401, 'a second login immediately invalidates the first session');

  result = await json('/auth/me', authorized(adminToken));
  check(
    result.response.status === 200 && result.body.permissions.includes('analytics:read'),
    'Super Admin identity includes analytics permission',
  );

  result = await json('/generations');
  check(result.response.status === 401, 'protected generation ledger rejects anonymous access');

  result = await json('/generations/presets', authorized(adminToken));
  check(
    result.response.status === 200 && result.body.length === 7,
    'all seven product categories are available',
  );
  check(
    result.body.every((category) => category.scenes.length === 3),
    'every category exposes three thoughtful scenes',
  );
  const clothingPreset = result.body.find((category) => category.id === 'clothing');
  check(
    clothingPreset.optionGroups.some((group) => group.id === 'model-casting') &&
      clothingPreset.optionGroups
        .flatMap((group) => group.options)
        .some((option) => option.id === 'modelGender' && option.choices.length >= 4),
    'clothing exposes detailed model casting controls',
  );
  result = await json('/generations/configuration', authorized(adminToken));
  runtimeConfig = result.body;
  check(
    result.response.status === 200 &&
      ['cloudflare', 'gemini', 'openai'].includes(runtimeConfig.provider),
    'generation provider configuration is exposed without secrets',
  );
  check(
    runtimeConfig.model && Array.isArray(runtimeConfig.missingConfiguration),
    'generation provider readiness and model are reported',
  );

  result = await json('/admin/overview?days=30', authorized(adminToken));
  check(
    result.response.status === 200 && result.body.summary && result.body.queue,
    'admin overview returns live analytics and queue health',
  );
  check(
    result.body.configuration.availableProviders.length === 3 &&
      result.body.configuration.availableProviders.some(
        (provider) => provider.provider === 'gemini' && provider.model === 'gemini-2.5-flash-image',
      ),
    'admin overview exposes configured model choices without provider secrets',
  );
  result = await json(
    '/admin/generation-provider',
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ provider: runtimeConfig.provider }),
    }),
  );
  check(
    result.response.status === 200 && result.body.provider === runtimeConfig.provider,
    'Super Admin can persist the active generation model',
  );

  result = await json('/admin/overview?days=13', authorized(adminToken));
  check(result.response.status === 400, 'analytics range validation rejects unsupported periods');

  result = await json('/analytics/visits', {
    method: 'POST',
    body: JSON.stringify({ path: '/system-test', visitorId, referrer: 'https://example.test/' }),
  });
  check(
    result.response.status === 202 && result.body.recorded,
    'public site analytics records a privacy-safe page view',
  );
  result = await json('/analytics/visits', {
    method: 'POST',
    body: JSON.stringify({ path: '/system-test', visitorId }),
  });
  check(
    result.response.status === 202 && !result.body.recorded,
    'rapid duplicate page views are de-duplicated',
  );

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

  const userOne = await createUser(adminToken, 'userOne', 'Verify User One');
  const userTwo = await createUser(adminToken, 'userTwo', 'Verify User Two');

  result = await json(
    `/users/${userOne.id}`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Verify User One Edited' }),
    }),
  );
  check(
    result.response.status === 200 && result.body.name === 'Verify User One Edited',
    'Super Admin can edit a user account',
  );
  result = await json('/users', authorized(adminToken));
  check(
    result.response.status === 200 &&
      result.body.some(
        (user) =>
          user.id === userOne.id && 'lastLoginAt' in user && typeof user.loginCount === 'number',
      ),
    'user list includes login activity and management metadata',
  );
  result = await json(
    `/users/${userOne.id}/access`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({
        requestLimitPerHour: 5,
        requestLimitPerDay: 20,
        maxVariantsPerRequest: 2,
        maxConcurrentRequests: 1,
      }),
    }),
  );
  check(
    result.response.status === 200 &&
      result.body.requestLimitPerHour === 5 &&
      result.body.maxVariantsPerRequest === 2,
    'Super Admin can configure enforceable user request and image limits',
  );

  result = await json(
    '/users',
    authorized(adminToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate', email: emails.userTwo, password }),
    }),
  );
  check(result.response.status === 409, 'duplicate user email is rejected');
  result = await json(
    '/users',
    authorized(adminToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weak',
        email: `weak-${stamp}@aluna.test`,
        password: 'short',
      }),
    }),
  );
  check(result.response.status === 400, 'weak user password is rejected');
  result = await json(
    '/users',
    authorized(adminToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Role injection',
        email: `role-${stamp}@aluna.test`,
        password,
        role: 'SUPER_ADMIN',
      }),
    }),
  );
  check(result.response.status === 400, 'a second Super Admin cannot be created through the API');

  const [firstUserOneLogin, userTwoLogin] = await Promise.all([
    login(emails.userOne),
    login(emails.userTwo),
  ]);
  check(
    firstUserOneLogin.response.status === 200 && firstUserOneLogin.body.user.role === 'USER',
    'normal user can authenticate with full Studio access',
  );
  check(userTwoLogin.response.status === 200, 'a second independent user can authenticate');

  const secondUserOneLogin = await login(emails.userOne);
  result = await json('/auth/me', authorized(firstUserOneLogin.body.accessToken));
  check(result.response.status === 401, 'a user account permits only one active login');
  let userOneToken = secondUserOneLogin.body.accessToken;

  result = await json('/admin/overview?days=7', authorized(userOneToken));
  check(result.response.status === 403, 'normal user cannot access Super Admin analytics');
  result = await json(
    '/admin/generation-provider',
    authorized(userOneToken, {
      method: 'PATCH',
      body: JSON.stringify({ provider: 'cloudflare' }),
    }),
  );
  check(result.response.status === 403, 'normal user cannot change the global generation model');
  result = await json('/admin/overview?days=7', authorized(adminToken));
  check(result.response.status === 200, 'Super Admin can access analytics');

  result = await json(
    '/users',
    authorized(userOneToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Forbidden',
        email: `forbidden-${stamp}@aluna.test`,
        password,
      }),
    }),
  );
  check(result.response.status === 403, 'normal user cannot create or manage accounts');

  result = await fetch(
    `${api}/generations`,
    authorized(userOneToken, { method: 'POST', body: new FormData() }),
  );
  check(result.status === 400, 'normal user can generate and must provide an image upload');

  result = await json(`/generations/${crypto.randomUUID()}`, authorized(userOneToken));
  check(result.response.status === 404, 'unknown generation is not exposed');

  const refreshed = await json('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: secondAdminLogin.body.refreshToken }),
  });
  check(refreshed.response.status === 200, 'refresh token rotates successfully');
  adminToken = refreshed.body.accessToken;
  result = await json('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: secondAdminLogin.body.refreshToken }),
  });
  check(result.response.status === 401, 'rotated refresh token cannot be reused');

  const superAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
  check(superAdmins === 1, 'the database contains exactly one Super Admin');
  result = await json(
    `/users/${secondAdminLogin.body.user.id}/status`,
    authorized(adminToken, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }),
  );
  check(result.response.status === 403, 'the Super Admin account cannot be suspended');
  result = await json(
    `/users/${secondAdminLogin.body.user.id}`,
    authorized(adminToken, { method: 'DELETE' }),
  );
  check(result.response.status === 403, 'the Super Admin account cannot be deleted');

  result = await json(
    `/users/${userTwo.id}/role`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'SUPER_ADMIN' }),
    }),
  );
  check(result.response.status === 404, 'role-changing endpoint does not exist');
  result = await json(
    `/users/${userTwo.id}/status`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    }),
  );
  check(result.response.status === 200 && !result.body.isActive, 'Super Admin can suspend a user');
  result = await login(emails.userTwo);
  check(result.response.status === 403, 'deactivated user cannot authenticate');
  result = await json(
    `/users/${userTwo.id}/status`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    }),
  );
  check(result.response.status === 200 && result.body.isActive, 'Super Admin can restore a user');
  let restoredUserTwoLogin = await login(emails.userTwo);
  check(restoredUserTwoLogin.response.status === 200, 'restored user can authenticate again');
  result = await json(
    `/users/${userTwo.id}/access`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({
        bannedUntil: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
        banReason: 'Automated policy test',
      }),
    }),
  );
  check(
    result.response.status === 200 && result.body.bannedUntil,
    'Super Admin can apply an hourly ban',
  );
  result = await json('/auth/me', authorized(restoredUserTwoLogin.body.accessToken));
  check(result.response.status === 403, 'a timed ban immediately blocks the existing session');
  result = await login(emails.userTwo);
  check(result.response.status === 403, 'a timed ban blocks new logins');
  result = await json(
    `/users/${userTwo.id}/access`,
    authorized(adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ bannedUntil: null, banReason: null }),
    }),
  );
  check(
    result.response.status === 200 && !result.body.bannedUntil,
    'Super Admin can clear a timed ban',
  );
  restoredUserTwoLogin = await login(emails.userTwo);
  check(restoredUserTwoLogin.response.status === 200, 'unbanned user can authenticate again');

  // Deliberately malformed image bytes exercise the complete queue failure path without
  // consuming provider credits during routine verification.
  const png = Buffer.from('not-a-real-image');
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'verify-product.png');
  form.append('category', 'clothing');
  form.append('sceneId', 'studio');
  form.append('variants', '1');
  form.append(
    'options',
    JSON.stringify({
      presentation: 'on-model',
      modelGender: 'female',
      modelAge: '35-49',
      modelHeritage: 'mena',
      bodyBuild: 'curvy',
      hairDirection: 'curls',
      expression: 'confident',
      castingDiversity: 'unique-each',
      pose: 'walking',
      framing: 'full-body',
      campaignMood: 'bold-editorial',
      composition: 'vary',
      camera: 'natural-50',
      lighting: 'soft-studio',
      palette: 'warm-neutral',
      variationStrength: 'adventurous',
    }),
  );
  const queued = await fetch(
    `${api}/generations`,
    authorized(userOneToken, { method: 'POST', body: form }),
  );
  const queuedBody = await queued.json();
  check(
    queued.status === 201 && queuedBody.status === 'queued',
    'normal user can enqueue a valid multipart generation',
  );
  generationId = queuedBody.id;
  const failedRun = await waitForFinalGeneration(userOneToken);
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
  check(
    failedRun.creativeOptions.modelGender === 'female' &&
      failedRun.creativeOptions.castingDiversity === 'unique-each',
    'creative casting controls are validated and persisted with the run',
  );

  result = await json(
    `/generations/${generationId}`,
    authorized(restoredUserTwoLogin.body.accessToken),
  );
  check(result.response.status === 404, 'one user cannot inspect another user’s generation');

  result = await json('/admin/overview?days=7', authorized(adminToken));
  check(
    result.response.status === 200 &&
      result.body.recentGenerations.some((run) => run.id === generationId),
    'every user request appears in Super Admin analytics',
  );
  check(
    result.body.userConsumption.some(
      (user) => user.id === userOne.id && Array.isArray(user.providerUsage),
    ),
    'Super Admin receives per-user images, tokens, provider units, spend, and failures',
  );
  check(
    result.body.summary.siteVisits >= 1 &&
      result.body.topPages.some((page) => page.path === '/system-test'),
    'admin analytics includes real visits, unique visitors, and popular pages',
  );
  check(
    'remainingCreditValueUsd' in result.body.configuration &&
      'estimatedImagesRemaining' in result.body.configuration,
    'admin analytics reports remaining provider units, credit value, and image capacity',
  );

  result = await json(`/admin/generations?take=20&search=${generationId}`, authorized(adminToken));
  check(
    result.response.status === 200 &&
      result.body.total >= 1 &&
      result.body.items[0].id === generationId &&
      result.body.items[0].inputUrl &&
      Array.isArray(result.body.items[0].resultUrls),
    'complete generation audit exposes source and result references',
  );
  const sourcePreview = await fetch(
    `${api}/generations/${generationId}/input`,
    authorized(adminToken),
  );
  check(sourcePreview.status === 200, 'Super Admin can securely inspect a user source image');

  result = await json('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: restoredUserTwoLogin.body.refreshToken }),
  });
  check(result.response.status === 204, 'logout revokes the active session');
  result = await json('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: restoredUserTwoLogin.body.refreshToken }),
  });
  check(result.response.status === 401, 'logged-out refresh token is rejected');

  result = await json(`/users/${userOne.id}`, authorized(adminToken, { method: 'DELETE' }));
  check(result.response.status === 204, 'Super Admin can delete a user account');
  result = await json(`/admin/generations?take=20&search=${generationId}`, authorized(adminToken));
  check(
    result.response.status === 200 &&
      result.body.items[0].user.name === 'Verify User One Edited' &&
      result.body.items[0].user.email === emails.userOne,
    'generation ownership remains auditable after its user account is deleted',
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
  await prisma.siteVisit.deleteMany({ where: { visitorId } });
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
