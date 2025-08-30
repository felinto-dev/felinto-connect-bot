import { ExtendedPage } from '../utils';
import { SessionManager } from './SessionManager';

/**
 * Interface for session-enabled pages
 */
export interface SessionEnabledPage extends ExtendedPage {
	saveSession(): Promise<boolean>;
	clearSession(): Promise<boolean>;
	restoreSession(): Promise<boolean>;
	getSessionData(userDataDir?: string): Promise<any | null>;
}

/**
 * SessionPageExtender - Extends pages with session functionality
 */
export class SessionPageExtender {
	/**
	 * Extends a page with session management capabilities
	 */
	static extendPageWithSession(page: ExtendedPage, userDataDir: string): SessionEnabledPage {
		// Cast page to access session methods
		const sessionPage = page as any;
		
		// Add session methods
		sessionPage.saveSession = async (): Promise<boolean> => {
			try {
				const sessionData = await sessionPage.session.dump();
				return await SessionManager.saveSession(userDataDir, sessionData);
			} catch (error) {
				console.error('Failed to save session:', (error as Error).message);
				return false;
			}
		};

		sessionPage.clearSession = async (): Promise<boolean> => {
			return await SessionManager.clearSession(userDataDir);
		};

		// Add method to restore session after navigation
		sessionPage.restoreSession = async (): Promise<boolean> => {
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

		// Override getSessionData para usar session plugin quando disponível
		const originalGetSessionData = sessionPage.getSessionData;
		sessionPage.getSessionData = async (userDataDirParam?: string): Promise<any | null> => {
			try {
				// Se um userDataDir foi passado como parâmetro, lê do arquivo
				if (userDataDirParam) {
					return await SessionManager.loadSession(userDataDirParam);
				}
				
				// Sem parâmetro: usa session plugin se disponível, senão fallback
				if (sessionPage.session && typeof sessionPage.session.dump === 'function') {
					return await sessionPage.session.dump();
				}
				
				// Fallback para implementação padrão se session plugin não estiver disponível
				return await originalGetSessionData.call(sessionPage);
			} catch (error) {
				console.error('Failed to get session data:', (error as Error).message);
				return null;
			}
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

		// Restore session immediately after page extension (for initial navigation)
		// This ensures session is restored even if the page was already navigated
		setTimeout(async () => {
			try {
				await sessionPage.restoreSession();
			} catch (error) {
				// Ignore restore errors during initialization
			}
		}, 1000);

		return sessionPage as SessionEnabledPage;
	}
}
