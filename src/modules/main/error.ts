import { version } from './interfaces';

export default class extends Error {
	constructor(error: Error | string) {
		super(typeof error === 'string' ? error : error.message);
		typeof error === 'object' && error.stack ? (this.stack = error.stack) : null;
	}
}

export class VersionError extends Error {
	constructor(requested: string) {
		super(
			`IPC action message version "${requested}" is different than expected "${version}".\n` +
				'Be sure than the "@beyond-js/ipc" package versions used across the different processes to be the same or compatible'
		);
	}
}
