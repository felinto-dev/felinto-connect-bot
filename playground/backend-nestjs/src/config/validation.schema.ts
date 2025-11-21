import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Two Captcha Configuration
  TWO_CAPTCHA_KEY: Joi.string()
    .optional()
    .allow('')
    .description('Two Captcha API key'),

  // Chrome Headless Configuration
  DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN: Joi.number()
    .integer()
    .min(800)
    .max(3840)
    .default(1920)
    .description('Chrome headless width screen resolution'),

  DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN: Joi.number()
    .integer()
    .min(600)
    .max(2160)
    .default(1080)
    .description('Chrome headless height screen resolution'),

  CHROME_HEADLESS_WS_URL: Joi.string()
    .uri()
    .optional()
    .description('Chrome headless WebSocket URL'),

  CHROME_HEADLESS_ARGS: Joi.string()
    .optional()
    .description('Chrome headless launch arguments (comma-separated)'),

  // Proxy Configuration
  PROXY_USERNAME: Joi.string()
    .optional()
    .allow('')
    .description('Proxy username for authentication'),

  PROXY_PASSWORD: Joi.string()
    .optional()
    .allow('')
    .description('Proxy password for authentication'),

  // Environment Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .description('Application environment mode'),

  // Port Configuration
  PORT_NESTJS: Joi.number()
    .integer()
    .min(1024)
    .max(65535)
    .default(3002)
    .description('Port for NestJS backend server'),
});