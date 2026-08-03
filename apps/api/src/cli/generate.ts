import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isProductCategory, ProductCategory, STYLES_CONFIG } from '../generation/styles.config';

interface CliArguments {
  image: string;
  category: ProductCategory;
  scene: string;
  variants: number;
}

function readFlag(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): string {
  const sceneLines = Object.entries(STYLES_CONFIG)
    .map(([category, config]) => `  ${category}: ${config.scenes.map(({ id }) => id).join(', ')}`)
    .join('\n');

  return `Usage:
  pnpm generate --image ./test.jpg --category clothing --scene studio --variants 4

Categories and scenes:
${sceneLines}`;
}

function parseArguments(): CliArguments {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage());
    process.exit(0);
  }

  const image = readFlag('image');
  const category = readFlag('category');
  const scene = readFlag('scene');
  const variantsRaw = readFlag('variants') ?? '1';

  if (!image || !category || !scene) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }
  if (!isProductCategory(category)) {
    throw new Error(`Unknown category "${category}".\n\n${usage()}`);
  }

  const variants = Number(variantsRaw);
  if (!Number.isInteger(variants) || variants < 1 || variants > 12) {
    throw new Error('--variants must be an integer between 1 and 12');
  }

  return { image: resolve(image), category, scene, variants };
}

async function main(): Promise<void> {
  const args = parseArguments();
  loadEnv({ path: ['.env', 'apps/api/.env'], quiet: true });
  await access(args.image).catch(() => {
    throw new Error(`Input image not found: ${args.image}`);
  });

  const [{ CliModule }, { GenerationService }] = await Promise.all([
    import('./cli.module'),
    import('../generation/generation.service'),
  ]);
  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn', 'log'],
    abortOnError: false,
  });
  try {
    const service = app.get(GenerationService);
    const runtime = service.getRuntimeConfiguration();
    if (!runtime.configured) {
      throw new Error(
        `${runtime.providerLabel} is not configured; add ${runtime.missingConfiguration.join(' and ')} to apps/api/.env`,
      );
    }
    console.log(`Provider: ${runtime.providerLabel} · ${runtime.model}`);
    const result = await service.generate({
      imagePath: args.image,
      category: args.category,
      sceneId: args.scene,
      variants: args.variants,
    });

    console.log(
      `\nDone: ${result.outputKeys.length} variant(s) in ${result.durationMs} ms, estimated $${result.costUsd.toFixed(6)}`,
    );
    for (const key of result.outputKeys) {
      console.log(`  ${key}`);
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation failed: ${message}`);
  process.exitCode = 1;
});
