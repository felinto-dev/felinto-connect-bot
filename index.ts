import { Browser, ConnectOptions, GoToOptions, HTTPResponse, Page, Protocol } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import { validateEnvironmentVariables } from './utils/validate-environment-variables';
export * from './utils/cookies-converter';

interface ExtendedPage extends Page {
	takeScreenshot: () => Promise<void>;
}

export const screenshots: string[] = [];

puppeteerExtra.use(
	RecaptchaPlugin({
		provider: { id: '2captcha', token: process.env.TWO_CAPTCHA_KEY },
		visualFeedback: true,
	})
);

type newPageParams = {
	browserWSEndpoint?: string;
	userAgent?: string;
	cookies?: Protocol.Network.CookieParam[];
	timeout?: number; // timeout in seconds
	initialUrl?: string;
	navigationOptions?: GoToOptions;
	blockedResourcesTypes?: Set<string>;
	slowMo?: number;
	$json?: any;
};

export const newPage = async (params: newPageParams = {}) => {
	validateEnvironmentVariables();

	const getJson = (property: string) => params.$json?.[property];

	let browser: Browser;

	const commonPuppeteerExtraArgs: Partial<ConnectOptions> = {
		defaultViewport: {
			width: Number(process.env.DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN) || 1920,
			height: Number(process.env.DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN) || 1080,
		},
		slowMo: params.slowMo,
	};

	const browserWSEndpoint =
		getJson('browserWSEndpoint') ||
		params.browserWSEndpoint ||
		process.env.CHROME_HEADLESS_WS_URL;
	if (process.env.NODE_ENV === 'production') {
		browser = await puppeteerExtra.connect({
			browserWSEndpoint,
			...commonPuppeteerExtraArgs,
		});
	} else {
		browser = await puppeteerExtra.launch({
			headless: false,
			args: process.env.CHROME_HEADLESS_ARGS ? process.env.CHROME_HEADLESS_ARGS.split(',') : [],
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

	const browserUserAgent = getJson('browserUserAgent') || params.userAgent;
	if (browserUserAgent) {
		await page.setUserAgent(browserUserAgent);
	}

	const cookies = getJson('cookies') || params.cookies;
	if (cookies) {
		await page.setCookie(...cookies);
	}

	if (params.timeout) {
		page.setDefaultTimeout(params.timeout * 1000);
	}

	const initialUrl = getJson('productPageUrl') || params.initialUrl;
	const navigationOptions = params.navigationOptions || {
		waitUntil: 'domcontentloaded',
	};
	if (initialUrl) {
		await page.goto(initialUrl, navigationOptions);
	}

	return page;
};
