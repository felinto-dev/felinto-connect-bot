import { Page } from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';

export const newPage = async () => {
	puppeteerExtra.use(stealthPlugin());
	puppeteerExtra.use(
		RecaptchaPlugin({
			provider: { id: '2captcha', token: process.env.TWO_CAPTCHA_KEY },
			visualFeedback: true,
		})
	)

	const browser = await puppeteerExtra.connect({
		browserWSEndpoint: process.env.CHROME_HEADLESS_WS_URL,
		defaultViewport: { width: 1920, height: 1080 },
	});

	const page: Page = await browser.newPage();
	page.setDefaultNavigationTimeout(10 * 1000); // 10 seconds

	await page.authenticate({
		username: process.env.PROXY_USERNAME,
		password: process.env.PROXY_PASSWORD
	});

	return page;
}
