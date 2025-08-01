import { GoToOptions, Protocol, CookieParam } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { 
	validateEnvironmentVariables,
	BrowserFactory,
	PageConfigurator,
	ExtendedPage,
	RetryOptions
} from './utils';

// Export utilities and error classes
export * from './utils';

// Configure puppeteer-extra with reCAPTCHA plugin
puppeteerExtra.use(
	RecaptchaPlugin({
		provider: { id: '2captcha', token: process.env.TWO_CAPTCHA_KEY },
		visualFeedback: true,
	})
);

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

	return page;
};
