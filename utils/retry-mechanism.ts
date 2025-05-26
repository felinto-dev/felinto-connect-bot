// Retry mechanism with exponential backoff
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function retryOperation<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	baseDelay: number = 1000,
	operationName: string = 'operation'
): Promise<T | null> {
	let lastError: Error;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			
			if (attempt === maxRetries) {
				console.error(`${operationName} failed after ${maxRetries} attempts: ${lastError.message}`);
				return null;
			}

			const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
			console.warn(`${operationName} attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`);
			await sleep(delay);
		}
	}

	return null;
}

export interface RetryOptions {
	maxRetries?: number;
	baseDelay?: number;
} 