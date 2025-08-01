import type { ErrorResponseType } from './types';

export default class IPCError extends Error {
	constructor(error: ErrorResponseType | string) {
		super(typeof error === 'string' ? error : error.message);
		typeof error === 'object' && error.stack ? (this.stack = error.stack) : null;
	}
}
