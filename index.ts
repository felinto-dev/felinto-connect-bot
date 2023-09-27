import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

export const setupPuppeteerExtra = () => {
	puppeteerExtra.use(stealthPlugin());
}

export const connectBrowser = async () => {
	return puppeteerExtra.connect({
		browserWSEndpoint: process.env.CHROME_HEADLESS_WS_URL,
		defaultViewport: { width: 1920, height: 1080 },
	});
}

export const createPage = async (browser: any) => {
	const page = await browser.newPage();
	await page.setDefaultNavigationTimeout(10 * 1000);
	await page.authenticate({ username: process.env.PROXY_USERNAME, password: process.env.PROXY_PASSWORD });
	return page;
}

export const newPage = async () => {
	puppeteerExtra.use(stealthPlugin());
	const browser = await puppeteerExtra.connect({
		browserWSEndpoint: process.env.CHROME_HEADLESS_WS_URL,
		defaultViewport: { width: 1920, height: 1080 },
	});
	const page = await browser.newPage();
	await page.setDefaultNavigationTimeout(10 * 1000); // 10 seconds
	await page.authenticate({ username: process.env.PROXY_USERNAME, password: process.env.PROXY_PASSWORD });
	return page;
}
