export default class extends Error {
	constructor(error: Error | string) {
		super(typeof error === 'string' ? error : error.message);
		typeof error === 'object' && error.stack ? (this.stack = error.stack) : null;
	}
}
