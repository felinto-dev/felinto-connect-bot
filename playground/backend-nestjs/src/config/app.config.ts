export interface AppConfig {
  port: number;
  nodeEnv: string;
}

export interface TwoCaptchaConfig {
  key?: string;
}

export interface ChromeConfig {
  headless: {
    width: number;
    height: number;
    wsUrl: string;
    args: string[];
  };
}

export interface ProxyConfig {
  username?: string;
  password?: string;
}

export interface Configuration {
  port: number;
  nodeEnv: string;
  twoCaptcha: TwoCaptchaConfig;
  chrome: ChromeConfig;
  proxy: ProxyConfig;
}