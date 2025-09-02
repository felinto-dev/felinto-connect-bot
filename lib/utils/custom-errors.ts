// Custom Error Classes for Browser Operations
export class BrowserConnectionError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		this.name = 'BrowserConnectionError';
	}
}

export class PageCreationError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		this.name = 'PageCreationError';
	}
}

export class NavigationError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		this.name = 'NavigationError';
	}
}

export class AuthenticationError extends Error {
	constructor(message: string, public readonly cause?: Error) {
		super(message);
		this.name = 'AuthenticationError';
	}
} 