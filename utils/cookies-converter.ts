import { Protocol, CookieParam } from 'puppeteer-core';
import { Cookie } from 'tough-cookie';

export const puppeteerToHeaderSetCookie = (
	cookies: CookieParam[]
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
