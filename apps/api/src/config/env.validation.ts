import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  GEMINI_API_KEY: Joi.string().trim().min(1).required().messages({
    'any.required':
      'GEMINI_API_KEY is missing; copy apps/api/.env.example to apps/api/.env and add a Gemini API key',
    'string.empty':
      'GEMINI_API_KEY is missing; copy apps/api/.env.example to apps/api/.env and add a Gemini API key',
  }),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),
  GEMINI_IMAGE_OUTPUT_COST_USD: Joi.number().min(0).default(0.039),
  GEMINI_INPUT_COST_PER_MILLION_TOKENS_USD: Joi.number().min(0).default(0.3),
  R2_ACCOUNT_ID: Joi.string().allow('').optional(),
  R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  R2_BUCKET: Joi.string().allow('').optional(),
  R2_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
});
