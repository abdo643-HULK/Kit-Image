/**
 * Utils
 */
export function execOnce<T extends (...args: any[]) => ReturnType<T>>(
	fn: T
): T {
	let used = false;
	let result: ReturnType<T>;

	return ((...args: any[]) => {
		if (!used) {
			used = true;
			result = fn(...args);
		}
		return result;
	}) as T;
}

/**
 * Isomorphic base64 that works on the server and client
 */
export function toBase64(str: string = '') {
	if (typeof window === 'undefined') {
		return Buffer.from(str).toString('base64');
	}

	if (typeof self !== 'undefined') {
		return self.btoa(str);
	}

	return window.btoa(str);
}
