// Custom Error Classes for Browser Operations
export class BrowserConnectionError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		Object.defineProperty(this, 'name', { value: 'BrowserConnectionError', configurable: true });
	}
}

export class PageCreationError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		Object.defineProperty(this, 'name', { value: 'PageCreationError', configurable: true });
	}
}

export class NavigationError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		Object.defineProperty(this, 'name', { value: 'NavigationError', configurable: true });
	}
}

export class AuthenticationError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		Object.defineProperty(this, 'name', { value: 'AuthenticationError', configurable: true });
	}
} 