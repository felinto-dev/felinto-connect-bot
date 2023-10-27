import { Page } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';

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
	const requiredVars = [
		'TWO_CAPTCHA_KEY',
		'CHROME_HEADLESS_WS_URL',
		'PROXY_USERNAME',
		'PROXY_PASSWORD'
	];
	for (const variable of requiredVars) {
		if (!process.env[variable]) {
			throw new Error(`Environment variable ${variable} is missing.`);
		}
	}
};

export const newPage = async (): Promise<ExtendedPage> => {
	validateEnvironmentVariables();

	const browser = await puppeteerExtra.connect({
		browserWSEndpoint: process.env.CHROME_HEADLESS_WS_URL,
		defaultViewport: { width: 1920, height: 1080 },
	});

	const page: ExtendedPage = await browser.newPage();
	page.setDefaultNavigationTimeout(10 * 1000); // 10 seconds

	await page.authenticate({
		username: process.env.PROXY_USERNAME!,
		password: process.env.PROXY_PASSWORD!,
	});

	page.takeScreenshot = async () => {
		const screenshot = await page.screenshot({ encoding: 'base64' });
		screenshots.push(screenshot);
	}

	return page;
};
