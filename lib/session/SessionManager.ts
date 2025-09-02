import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Session Manager for handling persistence of browser sessions
 */
export class SessionManager {
	private static readonly SESSIONS_DIR = '/tmp/puppeteer-sessions';

	/**
	 * Generate safe filename from userDataDir
	 */
	private static getSafeFileName(userDataDir: string): string {
		return userDataDir.replace(/[^a-zA-Z0-9]/g, '_');
	}

	/**
	 * Get session file path
	 */
	private static getSessionFile(userDataDir: string): string {
		const safeFileName = this.getSafeFileName(userDataDir);
		return join(this.SESSIONS_DIR, `${safeFileName}.json`);
	}

	/**
	 * Save session data to disk
	 */
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

	/**
	 * Load session data from disk
	 */
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

	/**
	 * Check if session exists
	 */
	static async hasSession(userDataDir: string): Promise<boolean> {
		try {
			const sessionFile = this.getSessionFile(userDataDir);
			await fs.access(sessionFile);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Clear session
	 */
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
