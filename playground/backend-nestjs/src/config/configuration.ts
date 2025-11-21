export default () => ({
  port: parseInt(process.env.PORT_NESTJS || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  twoCaptcha: {
    key: process.env.TWO_CAPTCHA_KEY,
  },
  chrome: {
    headless: {
      width: parseInt(process.env.DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN || '1920', 10),
      height: parseInt(process.env.DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN || '1080', 10),
      wsUrl: process.env.CHROME_HEADLESS_WS_URL || 'ws://chromium:3000',
      args: process.env.CHROME_HEADLESS_ARGS?.split(',') || [],
    },
  },
  proxy: {
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  },
});