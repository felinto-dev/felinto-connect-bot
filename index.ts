import { Browser, ConnectOptions, Page, Protocol } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { Cookie } from 'tough-cookie';

interface ExtendedPage extends Page {
	takeScreenshot: () => Promise<void>;
}

export const screenshots: string[] = [];

puppeteerExtra.use(stealthPlugin());
puppeteerExtra.use(
	RecaptchaPlugin({
		provider: { id: '2captcha', token: process.env.TWO_CAPTCHA_KEY },
		visualFeedback: true,
	})
);

const validateEnvironmentVariables = () => {
	const productionRequiredVars = [
		'TWO_CAPTCHA_KEY',
		'CHROME_HEADLESS_WS_URL',
		'PROXY_USERNAME',
		'PROXY_PASSWORD'
	];

	const developmentRequiredVars = [
		'TWO_CAPTCHA_KEY',
	];

	if (!process.env.NODE_ENV || !['production', 'development'].includes(process.env.NODE_ENV)) {
		throw new Error('You MUST define NODE_ENV environment variable to use felinto-connect-bot npm package.')
	}

	const requiredVars = process.env.NODE_ENV === 'production' ? productionRequiredVars : developmentRequiredVars;

	for (const variable of requiredVars) {
		if (!process.env[variable]) {
			throw new Error(`Environment variable ${variable} is required for use felinto-connect-bot npm package.`);
		}
	}
};

export const newPage = async () => {
	validateEnvironmentVariables();

	let browser: Browser;

	const commonPuppeteerExtraArgs: Partial<ConnectOptions> = {
		defaultViewport: {
			width: Number(process.env.DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN) || 1920,
			height: Number(process.env.DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN) || 1080,
		},
	};

	if (process.env.NODE_ENV === 'production') {
		browser = await puppeteerExtra.connect({
			browserWSEndpoint: process.env.CHROME_HEADLESS_WS_URL,
			...commonPuppeteerExtraArgs,
		});
	} else {
		browser = await puppeteerExtra.launch({
			headless: false,
			...commonPuppeteerExtraArgs,
		});
	}

	const page = await browser.newPage() as ExtendedPage;
	page.setDefaultNavigationTimeout(60 * 1000); // 60 seconds

	if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
		await page.authenticate({
			username: process.env.PROXY_USERNAME!,
			password: process.env.PROXY_PASSWORD!,
		});
	}

	if (process.env.NODE_ENV === 'development') {
		page.close = async () => {
			console.log('simulating the closing of the page...')
		}
	}

	page.takeScreenshot = async () => {
		const screenshot = await page.screenshot({ encoding: 'base64' });
		screenshots.push(screenshot);
	}

	return page;
};

export const puppeteerToHeaderSetCookie = (
	cookies: Protocol.Network.CookieParam[]
) => {
	return cookies.map(cookie => {
		let cookieStr = `${cookie.name}=${cookie.value}`;
		return cookieStr;
	}).join('; ');
}

export const headerSetCookieToPuppeteer = (setCookieHeader: string) => {
	const cookies: any[] = [];
	const cookieStrings = setCookieHeader.split('; ');

	cookieStrings.forEach(cookieString => {
		const cookie = Cookie.parse(cookieString);
		if (cookie) {
			cookies.push({
				name: cookie.key,
				value: cookie.value,
				domain: cookie.domain,
				path: cookie.path,
				expires: cookie.expires instanceof Date ? cookie.expires.getTime() / 1000 : -1,
				httpOnly: cookie.httpOnly,
				secure: cookie.secure,
				sameSite: cookie.sameSite
			});
		}
	});

	return cookies;
}
