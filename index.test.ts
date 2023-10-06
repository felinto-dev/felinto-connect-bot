import { newPage, screenshots, takeScreenshot } from './index';
import { jest, expect, test } from '@jest/globals';

jest.setTimeout(30 * 1000);

test('check', () => {
	expect(typeof newPage).toBe('function');
})

test('add support to take screenshot and save in array', async () => {
	const page = await newPage();
	await page.goto("https://www.google.com/recaptcha/api2/demo");
	await page.takeScreenshot();
	await page.close();
	expect(screenshots.length).toBe(1);
})
