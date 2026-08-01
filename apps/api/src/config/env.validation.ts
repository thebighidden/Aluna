import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  CORS_ORIGINS: Joi.string().default(
    'http://localhost:3000,http://localhost:4173,http://127.0.0.1:4173',
  ),
  GENERATION_PROVIDER: Joi.string().valid('cloudflare', 'openai', 'auto').default('cloudflare'),
  OPENAI_API_KEY: Joi.string().trim().allow('').optional(),
  OPENAI_ADMIN_KEY: Joi.string().trim().allow('').optional(),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .default('postgresql://product_photo:product_photo@localhost:5432/product_photo?schema=public'),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),
  OPENAI_IMAGE_MODEL: Joi.string().trim().default('gpt-image-2'),
  OPENAI_IMAGE_QUALITY: Joi.string().valid('low', 'medium', 'high', 'auto').default('medium'),
  OPENAI_IMAGE_SIZE: Joi.string().trim().default('1024x1024'),
  OPENAI_IMAGE_OUTPUT_COST_USD: Joi.number().min(0).default(0.053),
  CLOUDFLARE_ACCOUNT_ID: Joi.string().trim().allow('').optional(),
  CLOUDFLARE_API_TOKEN: Joi.string().trim().allow('').optional(),
  CLOUDFLARE_AI_MODEL: Joi.string().trim().default('@cf/black-forest-labs/flux-2-klein-9b'),
  CLOUDFLARE_AI_WIDTH: Joi.number().integer().min(256).max(1920).default(1024),
  CLOUDFLARE_AI_HEIGHT: Joi.number().integer().min(256).max(1920).default(1024),
  CLOUDFLARE_AI_DAILY_NEURON_BUDGET: Joi.number().integer().min(0).default(10000),
  JWT_ACCESS_SECRET: Joi.string().min(32).default('aluna-development-access-secret-change-me-2026'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .default('aluna-development-refresh-secret-change-me-2026'),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().min(3600).default(604800),
  DEMO_USER_EMAIL: Joi.string().email().default('demo@aluna.studio'),
  DEMO_USER_PASSWORD: Joi.string().min(12).default('AlunaDemo2026!'),
  R2_ACCOUNT_ID: Joi.string().allow('').optional(),
  R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  R2_BUCKET: Joi.string().allow('').optional(),
  R2_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
});
