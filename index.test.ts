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
			"name": "test_ga_523JXC6VL7",
			"path": "/",
			"size": 56,
			"value": "GS1.1.1704209349.1.1.1704209352.57.0.0",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1738769352.134684,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_pin_unauth",
			"path": "/",
			"size": 81,
			"value": "dWlkPU9UQXpPRFkyWWpRdFlXWXpNQzAwWkdRekxUbGtPRGt0T0dNME9XTTBNekExTWpjMg",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1735745352,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "csrf_accounts",
			"path": "/",
			"size": 45,
			"value": "f2f3408ed87e22294725bb1668521048",
			"domain": "www.flaticon.com",
			"secure": true,
			"expires": 1704216549.602973,
			"session": false,
			"httpOnly": true,
			"sameSite": "Strict",
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "test_ga",
			"path": "/",
			"size": 34,
			"value": "GA1.1.1169571913.1704209349",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1738769352.135095,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_ga",
			"path": "/",
			"size": 30,
			"value": "GA1.2.1169571913.1704209349",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1738769350.756468,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_gat",
			"path": "/",
			"size": 5,
			"value": "1",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1704209409,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_gid",
			"path": "/",
			"size": 31,
			"value": "GA1.2.1231339021.1704209349",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1704295750,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "CB_URL",
			"path": "/",
			"size": 47,
			"value": "https://www.flaticon.com/?k=1704209348881",
			"domain": "www.flaticon.com",
			"secure": false,
			"expires": 1704212948,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "fp_ga_1ZY8468CQB",
			"path": "/",
			"size": 54,
			"value": "GS1.1.1704209349.1.1.1704209352.57.0.0",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1738769352.166229,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "FI_TOKEN",
			"path": "/",
			"size": 1353,
			"value": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImQxNjg5NDE1ZWMyM2EzMzdlMmJiYWE1ZTNlNjhiNjZkYzk5MzY4ODQiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSm_Do28gUml6em9uIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hLS9BTjY2U0F5bzRZeV9ZeW8zOW5ZVTJkdTc5Y2gtQVVkTDU3NHRsVUQ5c3NMNm5RP3N6PTI1MCIsImFjY291bnRzX3VzZXJfaWQiOjEwNTE0NzIyLCJzY29wZXMiOiJmcmVlcGlrL2ltYWdlcyBmcmVlcGlrL3ZpZGVvcyBmbGF0aWNvbi9wbmcgZnJlZXBpay9pbWFnZXMvcHJlbWl1bSBmcmVlcGlrL3ZpZGVvcy9wcmVtaXVtIGZsYXRpY29uL3N2ZyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9mYy1wcm9maWxlLXByby1yZXYxIiwiYXVkIjoiZmMtcHJvZmlsZS1wcm8tcmV2MSIsImF1dGhfdGltZSI6MTcwNDIwOTM0NiwidXNlcl9pZCI6ImUwNTJjYTcyNzJlYzQwM2M4NTMzZDFjYWJiYjE1ODg1Iiwic3ViIjoiZTA1MmNhNzI3MmVjNDAzYzg1MzNkMWNhYmJiMTU4ODUiLCJpYXQiOjE3MDQyMDkzNDYsImV4cCI6MTcwNDIxMjk0NiwiZW1haWwiOiJqaHJpenpvbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjExNTQ0OTYzODg4MTIxMTA4MTI4NyJdLCJlbWFpbCI6WyJqaHJpenpvbkBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.DUENQsKBxH19FqiDIrbKP2HtoB7LzwrS3WLqKXd07gNvCHJBkEJ4h8RgYZtYx_6nqy5iBygqt8ZaV9mvOVfBycBiMjsY_UAFbqmqBqvW_7rQpNbxjYyCraeJEgc1JDzCtnZ1xmKXk7-HxP85QDyjZzVsHbKkcIfDOgr4EoSwhQsTyty_VsyCoOkQWwllGQjHnD4r0t-UbOYFFmT7yHag-HVHDzma_d6EGQnoMWZ-37lgGZOccD3B13DcG0S4mH-rzVDlBiJ5sLcZ-s7wzB6U-ZPtt4BmPETLr20Nt1-1VUgWw6bUI6i9JrXl6QNDmPtYk6q697XP5lfxLpAbtqrOGA",
			"domain": ".flaticon.com",
			"secure": true,
			"expires": 1704212886.517599,
			"session": false,
			"httpOnly": true,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_gcl_au",
			"path": "/",
			"size": 32,
			"value": "1.1.1703708333.1704209349",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1711985349,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "sponsor-chance",
			"path": "/",
			"size": 15,
			"value": "0",
			"domain": "www.flaticon.com",
			"secure": false,
			"expires": 1735745348,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "FI_REFRESH_TOKEN",
			"path": "/",
			"size": 220,
			"value": "AMf-vBxiQVHxdbmmtrA8fVeEL6J40x1pmBAc5XR2z6UJpW1H5HAkKqnuAgzmk5N3gBOoMQpcFiu1C0uqVWfk3OdooxEPJkjg7IIi4ULx8np410GUuryinyNxpNAEwJURBfkT1Pn22wGfEuHzJ_2g6zB0FoTjXpooF-W2Or8tsDFM4j2EnWBg_do4G9cbbNf8GNrVMK1Kf8kZ",
			"domain": ".flaticon.com",
			"secure": true,
			"expires": 1706801286.517631,
			"session": false,
			"httpOnly": true,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "csrf_flaticon",
			"path": "/",
			"size": 45,
			"value": "d39b5190a09ce9209c013801a8e0a9fa",
			"domain": "www.flaticon.com",
			"secure": true,
			"expires": 1704216549.12805,
			"session": false,
			"httpOnly": true,
			"sameSite": "Strict",
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "_ga_VZ04K43VYM",
			"path": "/",
			"size": 52,
			"value": "GS1.1.1704209349.1.0.1704209349.60.0.0",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1738769349.511384,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "currency",
			"path": "/",
			"size": 11,
			"value": "USD",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": -1,
			"session": true,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "country",
			"path": "/",
			"size": 9,
			"value": "US",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": -1,
			"session": true,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "fp_ga",
			"path": "/",
			"size": 32,
			"value": "GA1.1.1169571913.1704209349",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": 1738769352.166617,
			"session": false,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "gr_lang",
			"path": "/",
			"size": 9,
			"value": "en",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": -1,
			"session": true,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "GRID",
			"path": "/",
			"size": 12,
			"value": "10514722",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": -1,
			"session": true,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		},
		{
			"name": "city",
			"path": "/",
			"size": 9,
			"value": "Hurst",
			"domain": ".flaticon.com",
			"secure": false,
			"expires": -1,
			"session": true,
			"httpOnly": false,
			"sameParty": false,
			"sourcePort": 443,
			"sourceScheme": "Secure"
		}
	] as any as Protocol.Network.CookieParam[]
	const headerSetCookie = puppeteerToHeaderSetCookie(cookies);
	console.log(headerSetCookie);
	expect(headerSetCookie).not.toBe('');
})

test('header set cookie to puppeteer cookies', async () => {
	const cookie = 'elements.session.5=Fe26.2*0*06ab4ef5cf94f36645a849a81c324181b395e0a3812ba923ea0d092b74ac0304*Ti1C2evlqlRKk98KPzda0w*rDQaL2CWOA43HMiLOwQFAFeG6kfyu9WfJwt2AOOY7yY8ek7eotRguEHYzMc6ZVuF6BqGThPWR5wzJVr-luj2SaXZ7XGRzqOylNni8d4t0FRSl9aObM32UHplbeGgdHr1BeMVaXb9CPN7uX1XaYlTrwtdM08W84XJxs_OoU_1mso*1701380326575*ea2272d1c5c011e6e3f7044ae7d3bbb13a59d3fca07d70eca6dae7355b155dac*o4emCh3xIVQbK11_vFQBFb-xLJ0ut_-qslf-eBKZk4A~2; envato_client_id=2a4bb848-5041-4c0e-aeb6-89dac4f93ce7; _elements_session_4=ckpQZUFydkk4eXlRQmZpYUFsMWpjNlFSSFNrbHpaeDFWajlZZ20vK3YwY1FzTUJNRVRQSHptVTJwNDFqYng3ck9zL0l3dFZuOUVwOEV1K3djYysraHNJdE1NUVpnaHFoemhWQVFGczBnMllOOEtnMU1MMForYnA2bUxuQWFWcjB5dEM1S3BOUDZBdFI3eUdpUGVtUS9sNkhDNmM4VXpwUGFYamFtUVpvVmM3bi9MTzlqdnJ5S1ROWENoeEN0R1I4MTBpZ0JTQmJZMW5VWWpqSmkyb1NyLy8xdGVxQzZzN2h6cHd1ZjRGaU9VcnNhKytvMjREeUZJVEVRa0VqOTVJdklxS3ROeW1DRlluTzlvcXQwWWIxcTI0T3NseUJqeXdyemIwZWlibzhoVzFveHJ1cXlCUlRBSGc1cm1NYmw0emp0OCthaHRMY2JCaWNDb2hieWNHbjRLTGc5RmErYWtNdlBnbDhJTWRRbjlpckVxdlM5Umc0MW9TT053QldzeWRFWE9mZCt4VG1OQlpPaDZOZ3R4YlExdz09LS1MSTNoS0xPQnZvTlFhOUVEc2ZaMFd3PT0^%^3D--c1747e354c197c06e887451aa62d7d06094f295a; original_landing_page_url=https://elements.envato.com/; GO_EXP_STOREFRONT=acDRkPbsSg6ejqGlTTHslg=0&98dde361-fbf2-4a29-87e4-2663cc163783=0&45c01ccf-7690-4a86-81f8-bdc012aeb8e2=1; CookieConsent={stamp:^%^27-1^%^27^%^2Cnecessary:true^%^2Cpreferences:true^%^2Cstatistics:true^%^2Cmarketing:true^%^2Cmethod:^%^27implied^%^27^%^2Cver:1^%^2Cutc:1699613384970^%^2Cregion:^%^27BR^%^27}; psi={^%^22previouslySignedIn^%^22:true}; free_account_first_visit_dashboard=1; preferredLanguage=pt-BR; __cf_bm=22V8sJxC0vgtqx8Oxqew0cZefsealXYGOCd885cA9wQ-1700170703-0-AUsMM7mtAOiOfGDO92jkBiRfP+qdP2Mm0lPaVbYZeAPIOrARpBq40vHFSPQlBNfzedO8tzZqR2ADQkZYlk2FN/o=; __cf_bm=tDWo0C_mN5sf7gzN4VC7XJts6nedxV8J9AQaPe4GThw-1700170706-0-AeFJaFXHEtwcLb2m8aSXtjEOA0Bc4k7YC0GQ+1+l3PlklD7S2F+Vp4Y9b7O0hj4esByO7pfVsH4qZMuCQxqcbKI=';
	const puppeteerCookies = headerSetCookieToPuppeteer(cookie);
	expect(puppeteerCookies).toBeDefined();
})