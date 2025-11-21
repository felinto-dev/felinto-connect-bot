import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration, TwoCaptchaConfig, ChromeConfig, ProxyConfig } from './app.config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getPort(): number {
    return this.configService.get<number>('port')!;
  }

  getNodeEnv(): string {
    return this.configService.get<string>('nodeEnv')!;
  }

  getTwoCaptchaConfig(): TwoCaptchaConfig {
    return this.configService.get<TwoCaptchaConfig>('twoCaptcha')!;
  }

  getChromeConfig(): ChromeConfig {
    return this.configService.get<ChromeConfig>('chrome')!;
  }

  getProxyConfig(): ProxyConfig {
    return this.configService.get<ProxyConfig>('proxy')!;
  }

  // Helper method to get the entire configuration
  getAll(): Configuration {
    return {
      port: this.getPort(),
      nodeEnv: this.getNodeEnv(),
      twoCaptcha: this.getTwoCaptchaConfig(),
      chrome: this.getChromeConfig(),
      proxy: this.getProxyConfig(),
    };
  }
}