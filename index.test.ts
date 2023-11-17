import { Protocol } from 'puppeteer-core';
import { headerSetCookieToPuppeteer, newPage, puppeteerToHeaderSetCookie, screenshots } from './index';
import { jest, expect, test } from '@jest/globals';

jest.setTimeout(30 * 1000);

test('check', () => {
	console.log(`You're acessing the browserless instance from this address: ${process.env.CHROME_HEADLESS_WS_URL}`)
	expect(typeof newPage).toBe('function');
})

test('add support to take screenshot and save in array', async () => {
	const page = await newPage();
	await page.goto("https://www.google.com/recaptcha/api2/demo");
	await page.takeScreenshot();
	await page.close();
	expect(screenshots.length).toBe(1);
})

test('puppeteer cookies to header set cookie', async () => {
	const cookies = [
		{
			"name": "__cf_bm",
			"path": "/",
			"size": 152,
			"value": "BXvcnTy7WdLj1TRyRW_VQBRoBUnwRJo9vf6VZLZW3wY-1699629604-0-AbJKHiunsXcHKvFVtpmlbQINZZkQelILM31C8BwiTJOcOGDVeHQK+63uC1gEcRb0EI+3lx24KRaf4CwLl9xF0No=",
			"domain": ".elements.envato.com",
			"secure": true,
			"expires": 1699631404.115992,
			"session": false,
			"httpOnly": true,
			"sameSite": "None",
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "free_account_first_visit_dashboard",
			"path": "/",
			"size": 35,
			"value": "1",
			"domain": ".elements.envato.com",
			"secure": false,
			"expires": 1731165604,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_gat_elements",
			"path": "/",
			"size": 14,
			"value": "1",
			"domain": ".envato.com",
			"secure": false,
			"expires": 1699629664,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "elements.session.5",
			"path": "/",
			"size": 411,
			"value": "Fe26.2*0*74bb262b09b8eac7f2cf796341f4787ca9cfd673fb31573c2becd5a63ecbd818*_p52MCgZGLKPxjQCrUOIBA*4jfaP-lMcvZ5gSLZ5RSQvhSMdMHuucYBxyjtVYvKrVgyPXuIxPZTApetiPiONi3vnQHfjrI5VNMzcGxdG5LOAKY1QylqjJnT0W1rTISEWgnNooB9khAKwTpTIVRPZ06ByhyUPH7e3xYKBhn-fbPZGLgeVyl1BZqrUmUZhLXXWiQ*1700839203905*41f60d94417ae753d9e109bb9d3c16bc93fb0c8de59775e4e2b9418146c937a7*PNxgqRsmPn9tfRe2MoKFIMBgXP1xoel-MuXR0zv2qHE~2",
			"domain": ".elements.envato.com",
			"secure": true,
			"expires": 1700839143.944857,
			"session": false,
			"httpOnly": true,
			"sameSite": "Lax",
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "CookieConsent",
			"path": "/",
			"size": 172,
			"value": "{stamp:%27-1%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27implied%27%2Cver:1%2Cutc:1699629603786%2Cregion:%27US-51%27}",
			"domain": "elements.envato.com",
			"secure": true,
			"expires": 1702221603,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_elements_session_4",
			"path": "/",
			"size": 643,
			"value": "N3V5QkxSczF0RW42SWNSNFo5VER0U0F6OU43eDNnQXFRNi9uZzg5VVVSOE13dEhzbUJ2QTUrYzJjQ3FkWDZrUmsrOG9DQThYN2ZqR2hnWlJBRjJjclpvdzdRQ1RsaGVHQW9ReEJWNmJsRkVuTzBqTU5nVFNYV3FQeXVhNHBZZU1Bd05oVDQ4ek5uTzdEWHI5Q0RVeGI3N3hoRG9Cdi9ra1oyK1ByRHc1N2VpRGc5MDRpb1djSDdnT3RzTGxNNnY5ZFNQZGlGME92SDl5TGdWVkxYN2ZJZ1RpN1UxV0I3QXJ5L1dvRE53dzUwVk90UkRTdC8vUnlWVDNBeVBaODdUQTdsTm9STlUxbzkwNjMweVpUeW1EUGtrek9SbmNzZUl5dk9odVJGY0JWZ0d5bmN3SytBRHBxWjdYRkdXSjZycU1MaGJVUnEvYkt5Rm1VL0t0K01mWEhBTmhYK0tXa1ZVZlVLNC9lMzV1aGFZUmI1TVgxSDFCc0EyVjJEMVYySFBqYmEwRVgxZVB5dzFJNmxUZVJYcytkUT09LS1EQzd1WmplTmJINm9jckRuLzl0OHdRPT0%3D--93a607344b4093aaaae5fdce5d1fe836f522d5a8",
			"domain": ".elements.envato.com",
			"secure": true,
			"expires": 1700839203.944786,
			"session": false,
			"httpOnly": true,
			"sameSite": "Lax",
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "GO_EXP_STOREFRONT",
			"path": "/",
			"size": 119,
			"value": "acDRkPbsSg6ejqGlTTHslg=1&98dde361-fbf2-4a29-87e4-2663cc163783=0&45c01ccf-7690-4a86-81f8-bdc012aeb8e2=1",
			"domain": ".elements.envato.com",
			"secure": false,
			"expires": 1731165603,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_ga",
			"path": "/",
			"size": 28,
			"value": "GA1.2.29202728.1699629604",
			"domain": ".envato.com",
			"secure": false,
			"expires": 1734189603.924529,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "btt",
			"path": "/",
			"size": 46,
			"value": "a97168e2c6c14f34bc6eae0173fc6d79-8RZqyxDr8K",
			"domain": ".envato.com",
			"secure": false,
			"expires": 1734189600.256611,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 80,
			"sourceScheme": "NonSecure"
		},
		{
			"name": "__cf_bm",
			"path": "/",
			"size": 151,
			"value": "L5fjE0MN_fuUoa_I7wfrQpr3BnJDB1uA28jo2RjdOS8-1699629599-0-AXwiHj1s3z4+xmNGKGqrOvpGH89zGr7wAQw71kLhrU2pAaIlwIfD++hn+rQxpRawHZEQC81q/K7RM2mubRbk6Gk",
			"domain": ".envato.com",
			"secure": false,
			"expires": 1699631399,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 80,
			"sourceScheme": "NonSecure"
		},
		{
			"name": "original_landing_page_url",
			"path": "/",
			"size": 89,
			"value": "https://elements.envato.com/?utm_nooverride=1&tokenSignIn=SignIn",
			"domain": "elements.envato.com",
			"secure": false,
			"expires": 1731165603,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "envato_client_id",
			"path": "/",
			"size": 52,
			"value": "7e097524-bd57-441e-8678-4e1ab948aac6",
			"domain": ".elements.envato.com",
			"secure": true,
			"expires": 1731165602.53705,
			"session": false,
			"httpOnly": true,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_gid",
			"path": "/",
			"size": 30,
			"value": "GA1.2.405837965.1699629604",
			"domain": ".envato.com",
			"secure": false,
			"expires": 1699716003,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "envatosession",
			"path": "/",
			"size": 353,
			"value": "KoRy7XI07h7L%2F31pqNVn6lq%2BwDcjNPBDU3QWA4L46tcmz7NDBf0AVRwIhYsL2194QqrbFP5SppOzezYoDMK0z0pepqKE3dLtt6wWsQoKbo%2F7faQw0HuBntEolgEcCn56Marg8mb7jhV4zj0S9bhC0mKbcGKAMf4fQ5WYtq%2FcNIEc1CdN3oBGOT4GjlnTezjFtUosTt6EtHmXIsgqELl%2F0gcliBDFktjhqJrNFHaT4OGu8f7VlmsecXpSt8eCeFsnrYYlz60GG%2B6ijEt7tehP--LxHMuCsZBMV%2FvKde--TWCko4wX1rTzvpb1uI%2FXJQ%3D%3D",
			"domain": ".envato.com",
			"secure": false,
			"expires": 1715408075,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 80,
			"sourceScheme": "NonSecure"
		}
	] as any as Protocol.Network.CookieParam[]
	const headerSetCookie = puppeteerToHeaderSetCookie(cookies);
	expect(headerSetCookie).not.toBe('');
})

test('header set cookie to puppeteer cookies', async () => {
	const cookie = 'elements.session.5=Fe26.2*0*06ab4ef5cf94f36645a849a81c324181b395e0a3812ba923ea0d092b74ac0304*Ti1C2evlqlRKk98KPzda0w*rDQaL2CWOA43HMiLOwQFAFeG6kfyu9WfJwt2AOOY7yY8ek7eotRguEHYzMc6ZVuF6BqGThPWR5wzJVr-luj2SaXZ7XGRzqOylNni8d4t0FRSl9aObM32UHplbeGgdHr1BeMVaXb9CPN7uX1XaYlTrwtdM08W84XJxs_OoU_1mso*1701380326575*ea2272d1c5c011e6e3f7044ae7d3bbb13a59d3fca07d70eca6dae7355b155dac*o4emCh3xIVQbK11_vFQBFb-xLJ0ut_-qslf-eBKZk4A~2; envato_client_id=2a4bb848-5041-4c0e-aeb6-89dac4f93ce7; _elements_session_4=ckpQZUFydkk4eXlRQmZpYUFsMWpjNlFSSFNrbHpaeDFWajlZZ20vK3YwY1FzTUJNRVRQSHptVTJwNDFqYng3ck9zL0l3dFZuOUVwOEV1K3djYysraHNJdE1NUVpnaHFoemhWQVFGczBnMllOOEtnMU1MMForYnA2bUxuQWFWcjB5dEM1S3BOUDZBdFI3eUdpUGVtUS9sNkhDNmM4VXpwUGFYamFtUVpvVmM3bi9MTzlqdnJ5S1ROWENoeEN0R1I4MTBpZ0JTQmJZMW5VWWpqSmkyb1NyLy8xdGVxQzZzN2h6cHd1ZjRGaU9VcnNhKytvMjREeUZJVEVRa0VqOTVJdklxS3ROeW1DRlluTzlvcXQwWWIxcTI0T3NseUJqeXdyemIwZWlibzhoVzFveHJ1cXlCUlRBSGc1cm1NYmw0emp0OCthaHRMY2JCaWNDb2hieWNHbjRLTGc5RmErYWtNdlBnbDhJTWRRbjlpckVxdlM5Umc0MW9TT053QldzeWRFWE9mZCt4VG1OQlpPaDZOZ3R4YlExdz09LS1MSTNoS0xPQnZvTlFhOUVEc2ZaMFd3PT0^%^3D--c1747e354c197c06e887451aa62d7d06094f295a; original_landing_page_url=https://elements.envato.com/; GO_EXP_STOREFRONT=acDRkPbsSg6ejqGlTTHslg=0&98dde361-fbf2-4a29-87e4-2663cc163783=0&45c01ccf-7690-4a86-81f8-bdc012aeb8e2=1; CookieConsent={stamp:^%^27-1^%^27^%^2Cnecessary:true^%^2Cpreferences:true^%^2Cstatistics:true^%^2Cmarketing:true^%^2Cmethod:^%^27implied^%^27^%^2Cver:1^%^2Cutc:1699613384970^%^2Cregion:^%^27BR^%^27}; psi={^%^22previouslySignedIn^%^22:true}; free_account_first_visit_dashboard=1; preferredLanguage=pt-BR; __cf_bm=22V8sJxC0vgtqx8Oxqew0cZefsealXYGOCd885cA9wQ-1700170703-0-AUsMM7mtAOiOfGDO92jkBiRfP+qdP2Mm0lPaVbYZeAPIOrARpBq40vHFSPQlBNfzedO8tzZqR2ADQkZYlk2FN/o=; __cf_bm=tDWo0C_mN5sf7gzN4VC7XJts6nedxV8J9AQaPe4GThw-1700170706-0-AeFJaFXHEtwcLb2m8aSXtjEOA0Bc4k7YC0GQ+1+l3PlklD7S2F+Vp4Y9b7O0hj4esByO7pfVsH4qZMuCQxqcbKI=';
	const puppeteerCookies = headerSetCookieToPuppeteer(cookie);
	expect(puppeteerCookies).toBeDefined();
})