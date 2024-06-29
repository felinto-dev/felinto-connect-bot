export const validateEnvironmentVariables = () => {
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