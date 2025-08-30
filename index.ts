import { GoToOptions, Protocol, CookieParam } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
const SessionPluginModule = require('puppeteer-extra-plugin-session');
import { 
	validateEnvironmentVariables,
	BrowserFactory,
	PageConfigurator,
	ExtendedPage,
	RetryOptions,
	SessionDataApplier,
	SessionData
} from './utils';
import { SessionManager, SessionPageExtender, SessionEnabledPage } from './session';

// Export utilities and error classes
export * from './utils';
export * from './session';

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
	sessionData?: {
		cookies?: CookieParam[];
		localStorage?: Record<string, string>;
		sessionStorage?: Record<string, string>;
		[key: string]: any; // Allow additional session data
	};
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
	const sessionData = getJson('sessionData') || params.sessionData;

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

	// Handle session data and persistence
	let finalPage = page;
	
	// Add session persistence if userDataDir is provided
	if (userDataDir) {
		finalPage = SessionPageExtender.extendPageWithSession(page, userDataDir);
	}
	
	// Apply session data if provided (after page creation and initial navigation)
	if (sessionData) {
		try {
			// Apply sessionData (overrides any existing session data)
			// This happens after page creation and navigation, so it applies on top
			console.log('📋 Aplicando sessionData fornecido pelo usuário...');
			
			// If no initial URL was provided, navigate to about:blank first to ensure page context
			const currentUrl = finalPage.url();
			if (!currentUrl || currentUrl === 'about:blank') {
				await finalPage.goto('about:blank', { waitUntil: 'domcontentloaded' });
			}
			
			await SessionDataApplier.applySessionData(finalPage, sessionData);
		} catch (error) {
			console.warn('⚠️ Falha ao aplicar sessionData:', (error as Error).message);
			// Continue execution even if session data application fails
		}
	}

	return finalPage;
};
