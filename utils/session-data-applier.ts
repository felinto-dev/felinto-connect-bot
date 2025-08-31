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
			console.log(`🍪 Processando cookies: ${sessionData.cookies.length === 0 ? 'LIMPAR (array vazio)' : `APLICAR ${sessionData.cookies.length} cookies`}`);
			if (sessionData.cookies.length === 0) {
				// Clear all existing cookies using CDP (more reliable)
				console.log('🧹 Limpando todos os cookies via CDP...');
				
				try {
					// Check existing cookies first
					const existingCookies = await page.cookies();
					console.log(`📊 Cookies encontrados para deletar:`, existingCookies.map(c => `${c.name}@${c.domain}${c.path}`));
					
					// Use CDP to clear all browser cookies
					const client = await page.target().createCDPSession();
					await client.send('Network.clearBrowserCookies');
					console.log('✅ CDP clearBrowserCookies executado');
					
					// Also clear browser cache for good measure
					await client.send('Network.clearBrowserCache');
					console.log('✅ CDP clearBrowserCache executado');
					
					// Verify deletion worked
					const remainingCookies = await page.cookies();
					console.log(`📊 Cookies restantes após limpeza CDP:`, remainingCookies.map(c => `${c.name}@${c.domain}${c.path}`));
					
					// Fallback: try individual deletion if CDP didn't work completely
					if (remainingCookies.length > 0) {
						console.log('⚠️ Alguns cookies persistiram, tentando deleção individual...');
						for (const cookie of remainingCookies) {
							try {
								await page.deleteCookie({ 
									name: cookie.name, 
									domain: cookie.domain, 
									path: cookie.path || '/'
								});
								console.log(`✅ Cookie deletado individualmente: ${cookie.name}@${cookie.domain}`);
							} catch (error) {
								console.log(`❌ Falha ao deletar: ${cookie.name}@${cookie.domain} - ${(error as Error).message}`);
							}
						}
						
						// Final verification
						const finalCookies = await page.cookies();
						console.log(`📊 Cookies finais após limpeza completa:`, finalCookies.map(c => `${c.name}@${c.domain}${c.path}`));
					}
					
				} catch (error) {
					console.log(`❌ Falha na limpeza via CDP: ${(error as Error).message}`);
					console.log('🔄 Tentando método tradicional como fallback...');
					
					// Fallback to traditional method
					const existingCookies = await page.cookies();
					for (const cookie of existingCookies) {
						try {
							await page.deleteCookie({ 
								name: cookie.name, 
								domain: cookie.domain, 
								path: cookie.path || '/'
							});
							console.log(`✅ Cookie deletado (fallback): ${cookie.name}@${cookie.domain}`);
						} catch (error2) {
							console.log(`❌ Falha no fallback: ${cookie.name}@${cookie.domain} - ${(error2 as Error).message}`);
						}
					}
				}
				
			} else {
				// Apply provided cookies
				console.log(`🍪 Aplicando ${sessionData.cookies.length} cookies...`);
				await page.setCookie(...sessionData.cookies);
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
			const localStorageKeys = Object.keys(sessionData.localStorage).length;
			console.log(`💾 Processando localStorage: ${localStorageKeys === 0 ? 'LIMPAR (objeto vazio)' : `APLICAR ${localStorageKeys} itens`}`);
			if (Object.keys(sessionData.localStorage).length === 0) {
				// Clear all localStorage when empty object is provided
				console.log('🧹 Limpando todo o localStorage com múltiplas estratégias...');
				try {
					// First, check what's in localStorage
					const beforeClear = await page.evaluate(() => {
						try {
							const items: Record<string, string> = {};
							for (let i = 0; i < localStorage.length; i++) {
								const key = localStorage.key(i);
								if (key) items[key] = localStorage.getItem(key) || '';
							}
							return { success: true, items, error: null };
						} catch (e) {
							return { success: false, items: {}, error: (e as Error).message };
						}
					});
					
					if (beforeClear.success) {
						console.log('📊 localStorage antes da limpeza:', Object.keys(beforeClear.items));
						
						// Strategy 1: localStorage.clear()
						const clearResult = await page.evaluate(() => {
							try {
								localStorage.clear();
								return { success: true, error: null };
							} catch (e) {
								return { success: false, error: (e as Error).message };
							}
						});
						
						if (clearResult.success) {
							console.log('✅ localStorage.clear() executado com sucesso');
						} else {
							console.log('❌ localStorage.clear() falhou:', clearResult.error);
							
							// Strategy 2: Remove items individually
							console.log('🔄 Tentando remoção individual...');
							await page.evaluate(() => {
								try {
									const keys = Object.keys(localStorage);
									for (const key of keys) {
										localStorage.removeItem(key);
									}
									return { success: true, error: null };
								} catch (e) {
									return { success: false, error: (e as Error).message };
								}
							});
						}
						
						// Strategy 3: Use CDP to clear storage
						try {
							const client = await page.target().createCDPSession();
							const origin = await page.evaluate(() => location.origin);
							await client.send('DOMStorage.clear', {
								storageId: { securityOrigin: origin, isLocalStorage: true }
							});
							console.log('✅ CDP DOMStorage.clear (localStorage) executado');
						} catch (cdpError) {
							console.log('⚠️ CDP localStorage clear falhou:', (cdpError as Error).message);
						}
						
						// Verify localStorage is actually cleared
						const afterClear = await page.evaluate(() => {
							try {
								const items: Record<string, string> = {};
								for (let i = 0; i < localStorage.length; i++) {
									const key = localStorage.key(i);
									if (key) items[key] = localStorage.getItem(key) || '';
								}
								return { success: true, items, error: null };
							} catch (e) {
								return { success: false, items: {}, error: (e as Error).message };
							}
						});
						
						if (afterClear.success) {
							console.log('📊 localStorage após limpeza:', Object.keys(afterClear.items));
							if (Object.keys(afterClear.items).length === 0) {
								console.log('✅ localStorage completamente limpo!');
							}
						}
					} else {
						console.log('❌ Não foi possível acessar localStorage:', beforeClear.error);
					}
					
				} catch (error) {
					console.warn('⚠️ localStorage não pôde ser limpo (erro geral):', (error as Error).message);
				}
			} else {
				// Apply provided localStorage data
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
		}

		// Apply sessionStorage data with similar enhanced approach
		if (sessionData.sessionStorage !== undefined) {
			const sessionStorageKeys = Object.keys(sessionData.sessionStorage).length;
			console.log(`🔄 Processando sessionStorage: ${sessionStorageKeys === 0 ? 'LIMPAR (objeto vazio)' : `APLICAR ${sessionStorageKeys} itens`}`);
			if (Object.keys(sessionData.sessionStorage).length === 0) {
				// Clear all sessionStorage when empty object is provided
				console.log('🧹 Limpando todo o sessionStorage com múltiplas estratégias...');
				try {
					// First, check what's in sessionStorage
					const beforeClear = await page.evaluate(() => {
						try {
							const items: Record<string, string> = {};
							for (let i = 0; i < sessionStorage.length; i++) {
								const key = sessionStorage.key(i);
								if (key) items[key] = sessionStorage.getItem(key) || '';
							}
							return { success: true, items, error: null };
						} catch (e) {
							return { success: false, items: {}, error: (e as Error).message };
						}
					});
					
					if (beforeClear.success) {
						console.log('📊 sessionStorage antes da limpeza:', Object.keys(beforeClear.items));
						
						// Strategy 1: sessionStorage.clear()
						const clearResult = await page.evaluate(() => {
							try {
								sessionStorage.clear();
								return { success: true, error: null };
							} catch (e) {
								return { success: false, error: (e as Error).message };
							}
						});
						
						if (clearResult.success) {
							console.log('✅ sessionStorage.clear() executado com sucesso');
						} else {
							console.log('❌ sessionStorage.clear() falhou:', clearResult.error);
						}
						
						// Strategy 2: Use CDP to clear sessionStorage
						try {
							const client = await page.target().createCDPSession();
							const origin = await page.evaluate(() => location.origin);
							await client.send('DOMStorage.clear', {
								storageId: { securityOrigin: origin, isLocalStorage: false }
							});
							console.log('✅ CDP DOMStorage.clear (sessionStorage) executado');
						} catch (cdpError) {
							console.log('⚠️ CDP sessionStorage clear falhou:', (cdpError as Error).message);
						}
						
						// Verify sessionStorage is actually cleared
						const afterClear = await page.evaluate(() => {
							try {
								const items: Record<string, string> = {};
								for (let i = 0; i < sessionStorage.length; i++) {
									const key = sessionStorage.key(i);
									if (key) items[key] = sessionStorage.getItem(key) || '';
								}
								return { success: true, items, error: null };
							} catch (e) {
								return { success: false, items: {}, error: (e as Error).message };
							}
						});
						
						if (afterClear.success) {
							console.log('📊 sessionStorage após limpeza:', Object.keys(afterClear.items));
							if (Object.keys(afterClear.items).length === 0) {
								console.log('✅ sessionStorage completamente limpo!');
							}
						}
					} else {
						console.log('❌ Não foi possível acessar sessionStorage:', beforeClear.error);
					}
					
				} catch (error) {
					console.warn('⚠️ sessionStorage não pôde ser limpo (erro geral):', (error as Error).message);
				}
			} else {
				// Apply provided sessionStorage data
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
		}
	}

	/**
	 * Apply session data to a page (legacy method - now calls specific methods)
	 */
	static async applySessionData(page: ExtendedPage, sessionData: SessionData): Promise<void> {
		try {
			console.log('📝 Aplicando dados de sessão à página...');
			
			// Normalize empty sessionData {} to explicit clean state
			const normalizedSessionData = this.normalizeSessionData(sessionData);
			
			console.log('🔍 SessionData normalizado:', {
				cookies: normalizedSessionData.cookies ? `array[${normalizedSessionData.cookies.length}]` : 'undefined',
				localStorage: normalizedSessionData.localStorage ? `object{${Object.keys(normalizedSessionData.localStorage).length}}` : 'undefined', 
				sessionStorage: normalizedSessionData.sessionStorage ? `object{${Object.keys(normalizedSessionData.sessionStorage).length}}` : 'undefined'
			});

			// Apply cookies first (works on any page)
			await this.applyCookies(page, normalizedSessionData);

			// Apply storage (requires valid domain context)
			await this.applyStorage(page, normalizedSessionData);

			console.log('✅ Dados de sessão aplicados com sucesso!');
		} catch (error) {
			console.error('❌ Falha ao aplicar dados de sessão:', (error as Error).message);
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
			console.log('🧹 SessionData vazio {} detectado - interpretando como "limpar tudo"');
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
