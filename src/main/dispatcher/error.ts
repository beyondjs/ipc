import type { ErrorResponseType } from '../types';

/**
 * IPCError represents an error that occurred during inter-process communication (IPC).
 * It reconstructs the original error and uses the `cause` property to preserve the error chain.
 * This can be used for errors from child-to-parent, parent-to-child, or between sibling processes.
 */
export default class IPCError extends Error {
	constructor(error: ErrorResponseType) {
		// Recreate the original error from its serialized form
		const cause = new Error(error.message);
		cause.name = error.name;
		cause.stack = error.stack;

		// Initialize the base Error with the message and cause
		super(error.message, { cause });

		// Set a custom name for easier identification in logs or error handling
		this.name = 'IPCError';
	}
}
