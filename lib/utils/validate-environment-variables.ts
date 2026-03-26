export interface ValidateEnvOptions {
	twoCaptchaKey?: string;
	proxyUsername?: string;
	proxyPassword?: string;
}

export const validateEnvironmentVariables = (options: ValidateEnvOptions = {}) => {
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = 'production';
	}

	if (!['production', 'development'].includes(process.env.NODE_ENV)) {
		throw new Error('NODE_ENV must be either "production" or "development".');
	}

	// Build a pool of available values from both env vars and function params
	const resolvedValues: Record<string, string | undefined> = {
		TWO_CAPTCHA_KEY: options.twoCaptchaKey || process.env.TWO_CAPTCHA_KEY,
		PROXY_USERNAME: options.proxyUsername || process.env.PROXY_USERNAME,
		PROXY_PASSWORD: options.proxyPassword || process.env.PROXY_PASSWORD,
	};

	// Only validate values that are actually needed based on context.
	// These are optional features — the library works without them.
	const optionallyRequiredInProduction: Array<{
		var: keyof typeof resolvedValues;
		dependentValue?: string;
	}> = [
		// Proxy credentials are only required if a proxy server is configured
		{
			var: 'PROXY_USERNAME',
			dependentValue: process.env.PROXY_SERVER,
		},
		{
			var: 'PROXY_PASSWORD',
			dependentValue: process.env.PROXY_SERVER,
		},
	];

	if (process.env.NODE_ENV === 'production') {
		for (const { var: variable, dependentValue } of optionallyRequiredInProduction) {
			if (dependentValue && !resolvedValues[variable]) {
				throw new Error(
					`Environment variable ${variable} is required when a proxy server is configured.`
				);
			}
		}
	}
};
