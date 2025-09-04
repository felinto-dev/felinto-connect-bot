import {
	Browser,
	Page,
	ConnectOptions,
	CookieParam,
} from 'puppeteer';
import {
	BrowserConnectionError,
	PageCreationError,
	NavigationError,
	AuthenticationError,
} from './utils/custom-errors';
import { BrowserFactory } from './utils/browser-factory';
import { PageConfigurator } from './utils/page-configurator';
import { validateEnvironmentVariables } from './utils/validate-environment-variables';
import {
	SessionManager,
	SessionPageExtender,
} from './session';
import { ExtendedPage, NewPageParams } from './types';

// Export utilities and error classes
export * from './utils';
export * from './session';
export * from './types';

/**
 * Creates a new browser page with specified configuration
 * @param params Configuration parameters for the page
 * @returns Promise resolving to configured page instance
 * @throws {BrowserConnectionError} When unable to connect to browser
 * @throws {PageCreationError} When unable to create or configure page
 * @throws {NavigationError} When navigation fails
 * @throws {AuthenticationError} When proxy authentication fails
 */
export const newPage = async (
	params: NewPageParams = {},
): Promise<ExtendedPage> => {
	// Validate environment variables
	try {
		validateEnvironmentVariables();
	} catch (error) {
		throw new Error(`Environment validation failed: ${(error as Error).message}`);
	}

	const browser = await BrowserFactory.createBrowser({
		browserWSEndpoint:
			params.browserWSEndpoint || process.env.CHROME_HEADLESS_WS_URL,
		slowMo: params.connectOptions?.slowMo,
	});

	try {
		const page = await PageConfigurator.createAndConfigurePage(browser, {
			proxy: params.proxy,
			cookies: params.cookies,
			userAgent: params.userAgent,
			blockResources: params.blockResources,
			extraHeaders: params.extraHeaders,
			sessionManager: params.sessionManager,
			initialUrl: params.initialUrl,
			navigationOptions: params.navigationOptions,
		});

		// Adiciona a propriedade session ao objeto page
		if (params.sessionManager) {
			const sessionPage = SessionPageExtender.extendPageWithSession(page, '/tmp/puppeteer-sessions');
			return sessionPage as ExtendedPage;
		}

		return page;
	} catch (error) {
		// Ensure browser is closed on page creation failure
		const pages = await browser.pages();
		if (pages.length <= 1) { // Only close if it's the last page or no other pages opened by this process
			await browser.close();
		}
		throw error;
	}
};
