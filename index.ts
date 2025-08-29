import { GoToOptions, Protocol, CookieParam } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
const SessionPluginModule = require('puppeteer-extra-plugin-session');
import { 
	validateEnvironmentVariables,
	BrowserFactory,
	PageConfigurator,
	ExtendedPage,
	RetryOptions
} from './utils';
import { promises as fs } from 'fs';
import { join } from 'path';

// Export utilities and error classes
export * from './utils';

// Configure puppeteer-extra with plugins
puppeteerExtra.use(
	RecaptchaPlugin({
		provider: { id: '2captcha', token: process.env.TWO_CAPTCHA_KEY },
		visualFeedback: true,
	})
);

// Add session plugin for persistence
puppeteerExtra.use(SessionPluginModule.default());

// Configuration interface for newPage function
export interface NewPageParams {
	browserWSEndpoint?: string;
	userAgent?: string;
	cookies?: CookieParam[];
	timeout?: number; // timeout in seconds
	initialUrl?: string;
	navigationOptions?: GoToOptions;
	blockedResourcesTypes?: string[];
	slowMo?: number;
	$json?: any;
	retryOptions?: RetryOptions;
	userDataDir?: string; // Directory for session persistence
}

// Session Manager for handling persistence
class SessionManager {
	private static readonly SESSIONS_DIR = '/tmp/puppeteer-sessions';

	// Generate safe filename from userDataDir
	private static getSafeFileName(userDataDir: string): string {
		return userDataDir.replace(/[^a-zA-Z0-9]/g, '_');
	}

	// Get session file path
	private static getSessionFile(userDataDir: string): string {
		const safeFileName = this.getSafeFileName(userDataDir);
		return join(this.SESSIONS_DIR, `${safeFileName}.json`);
	}

	// Save session data to disk
	static async saveSession(userDataDir: string, sessionData: any): Promise<boolean> {
		try {
			await fs.mkdir(this.SESSIONS_DIR, { recursive: true });
			const sessionFile = this.getSessionFile(userDataDir);
			
			const dataToSave = {
				userDataDir,
				timestamp: Date.now(),
				sessionData
			};
			
			await fs.writeFile(sessionFile, JSON.stringify(dataToSave, null, 2));
			return true;
		} catch (error) {
			console.error('Failed to save session:', (error as Error).message);
			return false;
		}
	}

	// Load session data from disk
	static async loadSession(userDataDir: string): Promise<any | null> {
		try {
			const sessionFile = this.getSessionFile(userDataDir);
			const data = await fs.readFile(sessionFile, 'utf8');
			const parsed = JSON.parse(data);
			return parsed.sessionData;
		} catch (error) {
			// Session doesn't exist or is corrupted
			return null;
		}
	}

	// Check if session exists
	static async hasSession(userDataDir: string): Promise<boolean> {
		try {
			const sessionFile = this.getSessionFile(userDataDir);
			await fs.access(sessionFile);
			return true;
		} catch {
			return false;
		}
	}

	// Clear session
	static async clearSession(userDataDir: string): Promise<boolean> {
		try {
			const sessionFile = this.getSessionFile(userDataDir);
			await fs.unlink(sessionFile);
			return true;
		} catch (error) {
			return false;
		}
	}
}

// Get screenshots array from PageConfigurator
export const screenshots = PageConfigurator.getScreenshots();

/**
 * Creates a new browser page with specified configuration
 * @param params Configuration parameters for the page
 * @returns Promise resolving to configured page instance
 * @throws {BrowserConnectionError} When unable to connect to browser
 * @throws {PageCreationError} When unable to create or configure page
 * @throws {NavigationError} When navigation fails
 * @throws {AuthenticationError} When proxy authentication fails
 */
export const newPage = async (params: NewPageParams = {}): Promise<ExtendedPage> => {
	// Validate environment variables
	try {
		validateEnvironmentVariables();
	} catch (error) {
		throw new Error(`Environment validation failed: ${(error as Error).message}`);
	}

	// Extract configuration from JSON or direct params
	const getJson = (property: string) => params.$json?.[property];
	const retryOptions = params.retryOptions || { maxRetries: 3, baseDelay: 1000 };
	const userDataDir = getJson('userDataDir') || params.userDataDir;

	// Determine browser endpoint
	const browserWSEndpoint = 
		getJson('browserWSEndpoint') ||
		params.browserWSEndpoint ||
		process.env.CHROME_HEADLESS_WS_URL;

	// Create browser instance
	const browser = await BrowserFactory.createBrowser({
		browserWSEndpoint,
		slowMo: params.slowMo,
		retryOptions
	});

	// Create and configure page
	const page = await PageConfigurator.createAndConfigurePage(browser, {
		timeout: params.timeout,
		userAgent: getJson('browserUserAgent') || params.userAgent,
		cookies: getJson('cookies') || params.cookies,
		initialUrl: getJson('productPageUrl') || params.initialUrl,
		navigationOptions: params.navigationOptions,
		blockedResourcesTypes: getJson('blockedResourcesTypes') || params.blockedResourcesTypes,
		slowMo: params.slowMo,
		retryOptions
	});

	// Add session persistence if userDataDir is provided
	if (userDataDir) {
		// Cast page to access session methods
		const sessionPage = page as any;
		
		// Add methods first
		sessionPage.saveSession = async () => {
			try {
				const sessionData = await sessionPage.session.dump();
				return await SessionManager.saveSession(userDataDir, sessionData);
			} catch (error) {
				console.error('Failed to save session:', (error as Error).message);
				return false;
			}
		};

		sessionPage.clearSession = async () => {
			return await SessionManager.clearSession(userDataDir);
		};

		// Add method to restore session after navigation
		sessionPage.restoreSession = async () => {
			const savedSession = await SessionManager.loadSession(userDataDir);
			if (savedSession) {
				try {
					await sessionPage.session.restore(savedSession);
					return true;
				} catch (error) {
					console.warn('Failed to restore session:', (error as Error).message);
					return false;
				}
			}
			return false;
		};

		// Override goto to restore session after navigation
		const originalGoto = page.goto;
		page.goto = async (url: string, options?: any) => {
			const result = await originalGoto.call(page, url, options);
			
			// Try to restore session after successful navigation
			try {
				await sessionPage.restoreSession();
			} catch (error) {
				// Ignore restore errors during navigation
			}
			
			return result;
		};

		// Override close method to auto-save session
		const originalClose = page.close;
		page.close = async () => {
			try {
				const sessionData = await sessionPage.session.dump();
				await SessionManager.saveSession(userDataDir, sessionData);
			} catch (error) {
				// Ignore save errors during close
			}
			
			try {
				return await originalClose.call(page);
			} catch (closeError) {
				// Ignore close errors (common with remote browsers)
			}
		};
	}

	return page;
};

/**
 * Creates a new tab that reuses existing session if available
 * @param params Configuration parameters for the page (same as newPage)
 * @returns Promise resolving to configured page instance
 * @description If userDataDir is provided and a session exists, it will reuse the session data.
 * Otherwise, it behaves exactly like newPage.
 */
export const newTab = async (params: NewPageParams = {}): Promise<ExtendedPage> => {
	const userDataDir = params.$json?.userDataDir || params.userDataDir;
	
	if (userDataDir && await SessionManager.hasSession(userDataDir)) {
		// Session exists, create page with session restoration
		return await newPage(params);
	} else {
		// No session exists, create new page (same as newPage)
		return await newPage(params);
	}
};
