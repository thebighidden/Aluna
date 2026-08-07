import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const api = process.env.TEST_API_URL ?? 'http://127.0.0.1:3001';
const prisma = new PrismaClient();
const stamp = Date.now();
const email = `creative-director-${stamp}@aluna.test`;
const password = 'AlunaCreativeTest2026!';
let userId;
let passed = 0;

function check(condition, label) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}  ${label}`);
}

async function request(path, token, init = {}) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

try {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Creative Director Test',
      passwordHash: await hash(password, 12),
    },
  });
  userId = user.id;

  let result = await request('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  check(result.response.status === 200, 'temporary Studio user can authenticate');
  const token = result.body.accessToken;

  result = await request('/brand-profile', token);
  check(
    result.response.status === 200 && result.body.exists === false,
    'a new account receives safe Brand Profile defaults',
  );

  result = await request('/brand-profile', token, {
    method: 'PATCH',
    body: JSON.stringify({
      brandName: 'PowerLab Test',
      businessType: 'sports-nutrition',
      businessSubcategory: 'Creatine and performance supplements',
      slogan: 'Performance, measured.',
      audience: {
        primaryAudience: 'Active adults',
        ageRange: '20-40',
        geography: 'Morocco and France',
      },
      primaryColor: '#CBFF37',
      secondaryColors: ['#111111', '#F5F5F0'],
      tone: ['scientific', 'energetic', 'premium'],
      preferredEnvironments: ['performance gym', 'sports science studio'],
      forbiddenEnvironments: ['domestic kitchen', 'restaurant'],
      requiredVisualElements: ['clean copy space'],
      forbiddenVisualElements: ['medical claims'],
      onboardingComplete: true,
    }),
  });
  check(
    result.response.status === 200 && result.body.profile.version === 1,
    'the complete Brand Profile is persisted as version 1',
  );

  const logo = new FormData();
  logo.append(
    'logo',
    new Blob(
      [
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
          'base64',
        ),
      ],
      { type: 'image/png' },
    ),
    'powerlab.png',
  );
  result = await request('/brand-profile/logo', token, { method: 'POST', body: logo });
  check(
    result.response.status === 201 && result.body.profile.version === 2,
    'the official logo is stored and creates a new profile version',
  );

  result = await request('/creative-director/preview', token, {
    method: 'POST',
    body: JSON.stringify({
      category: 'food',
      sceneId: 'kitchen',
      variants: 4,
      productType: 'Creatine monohydrate powder',
      options: {},
    }),
  });
  check(result.response.status === 201, 'Creative Director preview is available without generation');
  check(
    result.body.productContext.productClass === 'sports nutrition or wellness supplement',
    'creatine is classified as a sports supplement rather than ordinary food',
  );
  check(
    result.body.effectiveCategory === 'wellness' &&
      result.body.effectiveSceneId === 'performance',
    'an incoherent kitchen selection is rerouted to Performance Studio',
  );
  check(
    result.body.productContext.forbiddenEnvironments.includes('domestic kitchen'),
    'the saved brand restriction is included in the generation context',
  );
  check(
    result.body.shots.length === 4 &&
      new Set(result.body.shots.map((shot) => shot.composition)).size > 1,
    'the campaign receives multiple meaningfully different shot plans',
  );
  check(
    result.body.prompt.includes('PowerLab Test') &&
      result.body.prompt.includes('Do not ask the image model to redraw it'),
    'the compiled prompt uses brand intelligence while protecting exact typography',
  );

  console.log(`\nCreative Director smoke test passed: ${passed} checks.`);
} finally {
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
}
