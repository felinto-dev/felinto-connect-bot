import { CookieParam } from 'puppeteer-core';
import { ExtendedPage } from './page-configurator';

/**
 * Interface for session data that can be applied to a page
 */
export interface SessionData {
	cookies?: CookieParam[];
	localStorage?: Record<string, string>;
	sessionStorage?: Record<string, string>;
	[key: string]: any; // Allow additional session data
}

/**
 * SessionDataApplier - Applies session data to a page
 */
export class SessionDataApplier {
	/**
	 * Apply cookies only using CDP for more reliable clearing
	 */
	static async applyCookies(page: ExtendedPage, sessionData: SessionData): Promise<void> {
		// Apply cookies - ALWAYS process if cookies property is defined
		if (sessionData.cookies !== undefined) {
			if (sessionData.cookies.length === 0) {
				// Clear all existing cookies using CDP (more reliable)
				
				try {
					// Check existing cookies first
					const existingCookies = await page.cookies();
					
					// Use CDP to clear all browser cookies
					const client = await page.target().createCDPSession();
					await client.send('Network.clearBrowserCookies');
					
					// Also clear browser cache for good measure
					await client.send('Network.clearBrowserCache');
					
					// Verify deletion worked
					const remainingCookies = await page.cookies();
					
					// Fallback: try individual deletion if CDP didn't work completely
					if (remainingCookies.length > 0) {
						for (const cookie of remainingCookies) {
							try {
								await page.deleteCookie({ 
									name: cookie.name, 
									domain: cookie.domain, 
									path: cookie.path || '/'
								});
							} catch (error) {
								// Ignore individual cookie deletion errors
							}
						}
						
					}
					
				} catch (error) {
					// Fallback to traditional method
					const existingCookies = await page.cookies();
					for (const cookie of existingCookies) {
						try {
							await page.deleteCookie({ 
								name: cookie.name, 
								domain: cookie.domain, 
								path: cookie.path || '/'
							});
						} catch (error2) {
							// Ignore fallback errors
						}
					}
				}
				
			} else {
				// Apply provided cookies with proper sameSite handling
				const validCookies = sessionData.cookies.map(cookie => ({
					...cookie,
					// Convert null sameSite to undefined (Chrome doesn't accept null)
					sameSite: cookie.sameSite === null ? undefined : cookie.sameSite
				}));
				await page.setCookie(...validCookies);
			}
		}
	}

	/**
	 * Apply storage data with enhanced clearing using multiple methods
	 */
	static async applyStorage(page: ExtendedPage, sessionData: SessionData): Promise<void> {
		// Wait for page to be in a proper state for storage access
		await page.waitForFunction(() => document.readyState === 'complete' || document.readyState === 'interactive');

		// Apply localStorage data - ALWAYS process if localStorage property is defined
		if (sessionData.localStorage !== undefined) {
			if (Object.keys(sessionData.localStorage).length === 0) {
				// Clear all localStorage when empty object is provided
				try {
					// Clear localStorage using multiple strategies
						
					// Strategy 1: localStorage.clear()
					await page.evaluate(() => {
						try {
							localStorage.clear();
						} catch (e) {
							// Strategy 2: Remove items individually if clear() fails
							const keys = Object.keys(localStorage);
							for (const key of keys) {
								localStorage.removeItem(key);
							}
						}
					});
						
											// Strategy 3: Use CDP to clear storage
					try {
						const client = await page.target().createCDPSession();
						const origin = await page.evaluate(() => location.origin);
						await client.send('DOMStorage.clear', {
							storageId: { securityOrigin: origin, isLocalStorage: true }
						});
					} catch (cdpError) {
						// Ignore CDP errors
					}
						
						
					
				} catch (error) {
					// Ignore localStorage clearing errors
				}
			} else {
				// Apply provided localStorage data
				try {
					await page.evaluate((data) => {
						try {
							for (const [key, value] of Object.entries(data)) {
								localStorage.setItem(key, value);
							}
						} catch (e) {
							// Ignore localStorage access errors
						}
					}, sessionData.localStorage);
				} catch (error) {
					// Ignore localStorage application errors
				}
			}
		}

		// Apply sessionStorage data with similar enhanced approach
		if (sessionData.sessionStorage !== undefined) {
			if (Object.keys(sessionData.sessionStorage).length === 0) {
				// Clear all sessionStorage when empty object is provided
				try {
					// Clear sessionStorage using multiple strategies
						
					// Strategy 1: sessionStorage.clear()
					await page.evaluate(() => {
						try {
							sessionStorage.clear();
						} catch (e) {
							// Ignore clear errors
						}
					});
						
											// Strategy 2: Use CDP to clear sessionStorage
					try {
						const client = await page.target().createCDPSession();
						const origin = await page.evaluate(() => location.origin);
						await client.send('DOMStorage.clear', {
							storageId: { securityOrigin: origin, isLocalStorage: false }
						});
					} catch (cdpError) {
						// Ignore CDP errors
					}
						
						
					
				} catch (error) {
					// Ignore sessionStorage clearing errors
				}
			} else {
				// Apply provided sessionStorage data
				try {
					await page.evaluate((data) => {
						try {
							for (const [key, value] of Object.entries(data)) {
								sessionStorage.setItem(key, value);
							}
						} catch (e) {
							// Ignore sessionStorage access errors
						}
					}, sessionData.sessionStorage);
				} catch (error) {
					// Ignore sessionStorage application errors
				}
			}
		}
	}

	/**
	 * Apply session data to a page (legacy method - now calls specific methods)
	 */
	static async applySessionData(page: ExtendedPage, sessionData: SessionData): Promise<void> {
		try {
			// Normalize empty sessionData {} to explicit clean state
			const normalizedSessionData = this.normalizeSessionData(sessionData);

			// Apply cookies first (works on any page)
			await this.applyCookies(page, normalizedSessionData);

			// Apply storage (requires valid domain context)
			await this.applyStorage(page, normalizedSessionData);
		} catch (error) {
			throw new Error(`Failed to apply session data: ${(error as Error).message}`);
		}
	}

	/**
	 * Normalize session data - treat {} as "clear everything"
	 */
	private static normalizeSessionData(sessionData: SessionData): SessionData {
		const keys = Object.keys(sessionData);
		
		// If sessionData is empty {} - treat as "clear everything"
		if (keys.length === 0) {
			return {
				cookies: [],
				localStorage: {},
				sessionStorage: {}
			};
		}
		
		// If sessionData has some properties, use as-is
		return sessionData;
	}

	/**
	 * Merge session data, giving priority to the second parameter
	 */
	static mergeSessionData(baseData: SessionData, overrideData: SessionData): SessionData {
		return {
			...baseData,
			...overrideData,
			cookies: [
				...(baseData.cookies || []),
				...(overrideData.cookies || [])
			].reduce((unique, cookie) => {
				// Remove duplicates by name and domain, keeping the last one
				const existing = unique.findIndex(c => c.name === cookie.name && c.domain === cookie.domain);
				if (existing >= 0) {
					unique[existing] = cookie;
				} else {
					unique.push(cookie);
				}
				return unique;
			}, [] as CookieParam[]),
			localStorage: {
				...(baseData.localStorage || {}),
				...(overrideData.localStorage || {})
			},
			sessionStorage: {
				...(baseData.sessionStorage || {}),
				...(overrideData.sessionStorage || {})
			}
		};
	}
}
