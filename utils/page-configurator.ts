import { Browser, GoToOptions, Page, Protocol, CookieParam } from 'puppeteer-core';
import { PageCreationError, AuthenticationError, NavigationError } from './custom-errors';
import { retryOperation, RetryOptions } from './retry-mechanism';
import { SessionManager } from '../session/SessionManager';

export interface ExtendedPage extends Page {
	takeScreenshot: () => Promise<void>;
	getSessionData: (userDataDir?: string) => Promise<any | null>;
}

export interface PageConfigurationOptions {
	timeout?: number;
	userAgent?: string;
	cookies?: CookieParam[];
	initialUrl?: string;
	navigationOptions?: GoToOptions;
	blockedResourcesTypes?: string[];
	slowMo?: number;
	retryOptions?: RetryOptions;
}

export class PageConfigurator {
	private static screenshots: string[] = [];

	static getScreenshots(): string[] {
		return this.screenshots;
	}

	static addScreenshot(screenshot: string): void {
		this.screenshots.push(screenshot);
	}

	static async createAndConfigurePage(
		browser: Browser, 
		options: PageConfigurationOptions
	): Promise<ExtendedPage> {
		const { 
			timeout = 60, 
			userAgent, 
			cookies, 
			initialUrl, 
			navigationOptions = { waitUntil: 'domcontentloaded' },
			blockedResourcesTypes,
			slowMo,
			retryOptions = { maxRetries: 3, baseDelay: 1000 }
		} = options;

		// Create page with error handling
		const pageResult = await retryOperation(
			async () => {
				try {
					return await browser.newPage() as ExtendedPage;
				} catch (error) {
					const err = error as Error;
					throw new PageCreationError(`Failed to create new page: ${err.message}`, err);
				}
			},
			retryOptions.maxRetries,
			retryOptions.baseDelay,
			'Page creation'
		);

		if (!pageResult) {
			await browser.close().catch(() => {});
			throw new PageCreationError('Failed to create page after all retry attempts', new Error('Page creation failed'));
		}

		const page: ExtendedPage = pageResult;

		// Configure page timeout
		try {
			page.setDefaultNavigationTimeout(timeout * 1000);
			page.setDefaultTimeout(timeout * 1000);
		} catch (error) {
			await browser.close().catch(() => {});
			throw new PageCreationError(`Failed to set page timeouts: ${(error as Error).message}`, error as Error);
		}

		// Setup proxy authentication
		await this.setupProxyAuthentication(page, browser);

		// Setup resource blocking
		await this.setupResourceBlocking(page, browser, blockedResourcesTypes);

		// Development mode page close override
		if (process.env.NODE_ENV === 'development') {
			page.close = async () => {
				console.log('simulating the closing of the page...')
			}
		}

		// Add screenshot functionality
		this.addScreenshotFunctionality(page);
		
		// Add session functionality
		this.addSessionFunctionality(page);

		// Configure user agent
		await this.configureUserAgent(page, browser, userAgent);

		// Set cookies
		await this.setCookies(page, browser, cookies);

		// Navigate to initial URL
		if (initialUrl) {
			await this.navigateToUrl(page, browser, initialUrl, navigationOptions, slowMo, retryOptions);
		}

		return page;
	}

	private static async setupProxyAuthentication(page: ExtendedPage, browser: Browser): Promise<void> {
		if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
			try {
				await page.authenticate({
					username: process.env.PROXY_USERNAME!,
					password: process.env.PROXY_PASSWORD!,
				});
			} catch (error) {
				await browser.close().catch(() => {});
				throw new AuthenticationError(`Proxy authentication failed: ${(error as Error).message}`, error as Error);
			}
		}
	}

	private static async setupResourceBlocking(page: ExtendedPage, browser: Browser, blockedTypes?: string[]): Promise<void> {
		if (blockedTypes && blockedTypes.length > 0) {
			try {
				// Remove duplicatas do array
				const uniqueBlockedTypes = [...new Set(blockedTypes)];
				
				await page.setRequestInterception(true);
				page.on('request', (request) => {
					// Verificar se a requisição já foi processada por outro interceptador
					if (request.isInterceptResolutionHandled()) return;
					
					const resourceType = request.resourceType();
					if (uniqueBlockedTypes.includes(resourceType)) {
						request.abort();
					} else {
						request.continue();
					}
				});
			} catch (error) {
				await browser.close().catch(() => {});
				throw new PageCreationError(`Failed to setup resource blocking: ${(error as Error).message}`, error as Error);
			}
		}
	}

	private static addScreenshotFunctionality(page: ExtendedPage): void {
		page.takeScreenshot = async () => {
			try {
				const screenshot = await page.screenshot({ encoding: 'base64' });
				PageConfigurator.addScreenshot(screenshot);
			} catch (error) {
				console.error(`Failed to take screenshot: ${(error as Error).message}`);
				throw error;
			}
		}
	}
	
	private static addSessionFunctionality(page: ExtendedPage): void {
		page.getSessionData = async (userDataDir?: string): Promise<any | null> => {
			try {
				// Se um userDataDir foi passado como parâmetro, lê do arquivo
				if (userDataDir) {
					return await SessionManager.loadSession(userDataDir);
				}
				
				// Sem parâmetro: retorna dados básicos da página atual
				// Para páginas sem sessão plugin, coleta dados manualmente
				const [cookies, localStorage, sessionStorage] = await Promise.all([
					page.cookies(),
					page.evaluate(() => {
						const data: Record<string, string> = {};
						for (let i = 0; i < window.localStorage.length; i++) {
							const key = window.localStorage.key(i);
							if (key) data[key] = window.localStorage.getItem(key) || '';
						}
						return data;
					}).catch(() => ({})),
					page.evaluate(() => {
						const data: Record<string, string> = {};
						for (let i = 0; i < window.sessionStorage.length; i++) {
							const key = window.sessionStorage.key(i);
							if (key) data[key] = window.sessionStorage.getItem(key) || '';
						}
						return data;
					}).catch(() => ({}))
				]);
				
				return {
					cookies,
					localStorage,
					sessionStorage,
					url: page.url(),
					timestamp: Date.now()
				};
			} catch (error) {
				console.error('Failed to get session data:', (error as Error).message);
				return null;
			}
		};
	}

	private static async configureUserAgent(page: ExtendedPage, browser: Browser, userAgent?: string): Promise<void> {
		if (userAgent) {
			try {
				await page.setUserAgent(userAgent);
			} catch (error) {
				await browser.close().catch(() => {});
				throw new PageCreationError(`Failed to set user agent: ${(error as Error).message}`, error as Error);
			}
		}
	}

	private static async setCookies(page: ExtendedPage, browser: Browser, cookies?: CookieParam[]): Promise<void> {
		if (cookies) {
			try {
				// Usando page.setCookie() que continua sendo a API padrão na v24
				// Esta API permanece estável e não foi depreciada
				await page.setCookie(...cookies);
			} catch (error) {
				await browser.close().catch(() => {});
				throw new PageCreationError(`Failed to set cookies: ${(error as Error).message}`, error as Error);
			}
		}
	}

	private static async navigateToUrl(
		page: ExtendedPage, 
		browser: Browser, 
		url: string, 
		navigationOptions: GoToOptions,
		slowMo?: number,
		retryOptions?: RetryOptions
	): Promise<void> {
		// Debug log dos parâmetros de navegação
		console.log('🔄 Navegação - Parâmetros configurados:', {
			url,
			navigationOptions,
			slowMo,
			retryOptions: {
				maxRetries: retryOptions?.maxRetries || 3,
				baseDelay: retryOptions?.baseDelay || 1000
			}
		});

		const navigationResult = await retryOperation(
			async () => {
				try {
					console.log(`🌐 Executando page.goto para: ${url}`);
					await page.goto(url, navigationOptions);
					console.log(`✅ Navegação bem-sucedida para: ${url}`);
					return true; // Sucesso na navegação
				} catch (error) {
					const err = error as Error;
					if (err.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
						throw new NavigationError(`URL not found: ${url}`, err);
					}
					if (err.message.includes('net::ERR_CONNECTION_REFUSED')) {
						throw new NavigationError(`Connection refused to: ${url}`, err);
					}
					if (err.message.includes('Navigation timeout')) {
						throw new NavigationError(`Navigation timeout for: ${url}`, err);
					}
					throw new NavigationError(`Navigation failed to ${url}: ${err.message}`, err);
				}
			},
			retryOptions?.maxRetries || 3,
			retryOptions?.baseDelay || 1000,
			'Page navigation'
		);

		if (!navigationResult) {
			await browser.close().catch(() => {});
			throw new NavigationError(`Failed to navigate to ${url} after all retry attempts`, new Error('Navigation failed'));
		}
		
		if (slowMo) {
			await new Promise(resolve => setTimeout(resolve, 5 * 1000));
		}
	}
} 