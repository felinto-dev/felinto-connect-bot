import { Browser } from 'puppeteer-core';
import {
	BrowserConnectionError,
	PageCreationError,
	AuthenticationError,
} from './custom-errors';
import { ExtendedPage, NewPageParams } from '../types';
import { SessionManager } from '../session';

export class PageConfigurator {
	static async createAndConfigurePage(
		browser: Browser,
		params: {
			proxy?: NewPageParams['proxy'];
			cookies?: NewPageParams['cookies'];
			userAgent?: string;
			blockResources?: boolean;
			extraHeaders?: Record<string, string>;
			sessionManager?: SessionManager;
			initialUrl?: string;
			navigationOptions?: NewPageParams['navigationOptions'];
		},
	): Promise<ExtendedPage> {
		try {
			const page = (await browser.newPage()) as ExtendedPage;

			if (params.proxy?.server) {
				const username = params.proxy.username || process.env.PROXY_USERNAME;
				const password = params.proxy.password || process.env.PROXY_PASSWORD;
				if (username && password) {
					await page.authenticate({ username, password });
				}
			}

			if (params.userAgent) {
				await page.setUserAgent(params.userAgent);
			}

			if (params.extraHeaders) {
				await page.setExtraHTTPHeaders(params.extraHeaders);
			}

			if (params.cookies) {
				await page.setCookie(...params.cookies);
			}

			if (params.blockResources) {
				await page.setRequestInterception(true);
				page.on('request', (request) => {
					const resourceType = request.resourceType();
					if (
						resourceType === 'image' ||
						resourceType === 'stylesheet' ||
						resourceType === 'font'
					) {
						request.abort();
					} else {
						request.continue();
					}
				});
			}

			if (params.initialUrl) {
				await page.goto(params.initialUrl, params.navigationOptions);
			}

			return page;
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}
			throw new PageCreationError(
				`Failed to create or configure page: ${(error as Error).message}`,
			);
		}
	}
} 