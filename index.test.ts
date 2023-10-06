import { newPage } from './index';
import { jest, expect, test } from '@jest/globals';

jest.setTimeout(30 * 1000);

test('check', () => {
	expect(typeof newPage).toBe('function');
})

test('check if puppeteer  is detected', async () => {
	const page = await newPage();
	await page.goto("https://arh.antoinevastel.com/bots/areyouheadless/");
	const browserStatus = await page.$('#res p');
	console.log(await browserStatus?.contentFrame());
	await page.close();
	expect(1).toBe(1);
})
