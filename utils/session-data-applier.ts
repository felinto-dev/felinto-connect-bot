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
	 * Apply session data to a page
	 */
	static async applySessionData(page: ExtendedPage, sessionData: SessionData): Promise<void> {
		try {
			console.log('📝 Aplicando dados de sessão à página...');

			// Apply cookies first
			if (sessionData.cookies && sessionData.cookies.length > 0) {
				console.log(`🍪 Aplicando ${sessionData.cookies.length} cookies...`);
				await page.setCookie(...sessionData.cookies);
			}

			// Wait for page to be in a proper state for storage access
			await page.waitForFunction(() => document.readyState === 'complete' || document.readyState === 'interactive');

			// Apply localStorage data with error handling
			if (sessionData.localStorage && Object.keys(sessionData.localStorage).length > 0) {
				console.log(`💾 Aplicando ${Object.keys(sessionData.localStorage).length} itens ao localStorage...`);
				try {
					await page.evaluate((data) => {
						try {
							for (const [key, value] of Object.entries(data)) {
								localStorage.setItem(key, value);
							}
						} catch (e) {
							console.warn('localStorage access denied:', (e as Error).message);
						}
					}, sessionData.localStorage);
				} catch (error) {
					console.warn('⚠️ localStorage não pôde ser aplicado (pode ser devido a políticas de segurança)');
				}
			}

			// Apply sessionStorage data with error handling
			if (sessionData.sessionStorage && Object.keys(sessionData.sessionStorage).length > 0) {
				console.log(`🔄 Aplicando ${Object.keys(sessionData.sessionStorage).length} itens ao sessionStorage...`);
				try {
					await page.evaluate((data) => {
						try {
							for (const [key, value] of Object.entries(data)) {
								sessionStorage.setItem(key, value);
							}
						} catch (e) {
							console.warn('sessionStorage access denied:', (e as Error).message);
						}
					}, sessionData.sessionStorage);
				} catch (error) {
					console.warn('⚠️ sessionStorage não pôde ser aplicado (pode ser devido a políticas de segurança)');
				}
			}

			console.log('✅ Dados de sessão aplicados com sucesso!');
		} catch (error) {
			console.error('❌ Falha ao aplicar dados de sessão:', (error as Error).message);
			throw new Error(`Failed to apply session data: ${(error as Error).message}`);
		}
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
