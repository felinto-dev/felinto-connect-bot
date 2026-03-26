import { Browser, ConnectOptions } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import puppeteerCore from 'puppeteer-core';

// Tell puppeteer-extra to use puppeteer-core instead of puppeteer
(puppeteerExtra as any).puppeteer = puppeteerCore;
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { BrowserConnectionError } from './custom-errors';
import { retryOperation, RetryOptions } from './retry-mechanism';

export interface BrowserFactoryOptions {
	browserWSEndpoint?: string;
	slowMo?: number;
	retryOptions?: RetryOptions;
	twoCaptchaKey?: string;
}

export class BrowserFactory {
	private static getCommonPuppeteerArgs(slowMo?: number): Partial<ConnectOptions> {
		// Em desenvolvimento, usar viewport padrão do navegador (null)
		// Em produção, usar valores configurados ou padrões
		const defaultViewport = process.env.NODE_ENV === 'development' 
			? null // Usa o viewport padrão do navegador
			: {
				width: Number(process.env.DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN) || 1920,
				height: Number(process.env.DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN) || 1080,
			};

		return {
			defaultViewport,
			slowMo,
		};
	}

	static async createBrowser(options: BrowserFactoryOptions): Promise<Browser> {
		const { browserWSEndpoint, slowMo, retryOptions = { maxRetries: 3, baseDelay: 1000 }, twoCaptchaKey } = options;

		const resolvedCaptchaKey = twoCaptchaKey || process.env.TWO_CAPTCHA_KEY;
		if (resolvedCaptchaKey) {
			puppeteerExtra.use(RecaptchaPlugin({
				provider: { id: '2captcha', token: resolvedCaptchaKey },
			}));
		}
		const commonArgs = this.getCommonPuppeteerArgs(slowMo);

		if (!browserWSEndpoint) {
			throw new BrowserConnectionError('Browser WebSocket endpoint is required. Please provide browserWSEndpoint or set CHROME_HEADLESS_WS_URL environment variable.');
		}

		// Se o endpoint for apenas ws://host:port, tentar obter o endpoint específico do browser
		let actualEndpoint = browserWSEndpoint;
		if (browserWSEndpoint.match(/^ws:\/\/[^\/]+:\d+$/)) {
			try {
				const httpUrl = browserWSEndpoint.replace('ws://', 'http://') + '/json/version';
				
				// Tentar usar fetch nativo ou Node.js API
				let response;
				if (typeof fetch !== 'undefined') {
					response = await fetch(httpUrl, { signal: AbortSignal.timeout(3000) });
					if (response.ok) {
						const versionData = await response.json();
						if (versionData.webSocketDebuggerUrl) {
							actualEndpoint = versionData.webSocketDebuggerUrl;
						}
					}
				} else {
					// Fallback para ambientes sem fetch - usar endpoint original
				}
			} catch (error) {
				// Continua com o endpoint original se a auto-detecção falhar
			}
		}

		try {
			const browser = await retryOperation(
				async () => {
					try {
						return await puppeteerExtra.connect({
							browserWSEndpoint: actualEndpoint,
							...commonArgs,
						});
					} catch (error) {
						const err = error as Error;
						if (err.message.includes('ECONNREFUSED') || err.message.includes('connection refused')) {
							throw new BrowserConnectionError(`Failed to connect to browser at ${browserWSEndpoint}`, err);
						}
						if (err.message.includes('timeout')) {
							throw new BrowserConnectionError(`Connection timeout to browser at ${browserWSEndpoint}`, err);
						}
						if (err.message.includes('WebSocket')) {
							throw new BrowserConnectionError(`WebSocket connection failed to ${browserWSEndpoint}`, err);
						}
						throw new BrowserConnectionError(`Unexpected browser connection error: ${err.message}`, err);
					}
				},
				retryOptions.maxRetries,
				retryOptions.baseDelay,
				'Browser connection'
			);

			if (!browser) {
				throw new BrowserConnectionError('Failed to create browser instance, received null.');
			}
			return browser;
			
		} catch (error) {
			if (error instanceof BrowserConnectionError) {
				throw error;
			}
			throw new BrowserConnectionError(`Failed to create browser: ${(error as Error).message}`, error as Error);
		}
	}
} 