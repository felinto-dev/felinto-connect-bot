export const validateEnvironmentVariables = () => {
	const productionRequiredVars = [
		'TWO_CAPTCHA_KEY',
		'PROXY_USERNAME',
		'PROXY_PASSWORD'
	];

	const developmentRequiredVars = [
		'TWO_CAPTCHA_KEY',
	];

	// Se NODE_ENV não estiver definida, assume 'production' como padrão
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = 'production';
	}

	if (!['production', 'development'].includes(process.env.NODE_ENV)) {
		throw new Error('NODE_ENV must be either "production" or "development".');
	}

	const requiredVars = process.env.NODE_ENV === 'production' ? productionRequiredVars : developmentRequiredVars;

	for (const variable of requiredVars) {
		if (!process.env[variable]) {
			throw new Error(`Environment variable ${variable} is required for use felinto-connect-bot npm package.`);
		}
	}
};