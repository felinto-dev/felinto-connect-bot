import { Page, ConnectOptions, CookieParam, GoToOptions } from 'puppeteer';
import { SessionManager, SessionPageExtender } from './session';

export interface ExtendedPage extends Page {
	session?: SessionPageExtender;
}

export interface NewPageParams {
	browserWSEndpoint?: string;
	proxy?: {
		server: string;
		username?: string;
		password?: string;
	};
	cookies?: CookieParam[];
	userAgent?: string;
	blockResources?: boolean;
	sessionManager?: SessionManager;
	extraHeaders?: Record<string, string>;
	connectOptions?: ConnectOptions;
	initialUrl?: string;
	navigationOptions?: GoToOptions;
}
