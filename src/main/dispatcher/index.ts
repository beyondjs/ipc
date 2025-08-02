import type MainProcessHandler from '../main';
import type ChildProcessHandler from '../child';
import type { IResponseMessage } from '../types';
import IPCError from './error';
import { PendingPromise } from '@beyond-js/pending-promise/main';
import { randomUUID } from 'crypto';

/**
 * Sends IPC action requests and routes responses across processes.
 * Used by both the main and child process to handle remote action execution.
 */
export default class Dispatcher {
	#process: NodeJS.Process;

	// Can be the main process or a child process handler
	#container: MainProcessHandler | ChildProcessHandler;

	/**
	 * Creates a new IPC Dispatcher instance.
	 *
	 * The Dispatcher handles sending actions (remote procedure calls) and routing the corresponding responses
	 * back to the appropriate promise resolver. It can be used in both the main process and child processes.
	 *
	 * In the main process, this class is typically instantiated once per child process and uses the `fork` parameter
	 * (a reference to the specific child process) to establish communication.
	 *
	 * In a child process, the `process` object is used implicitly to communicate with the parent process, and
	 * the `fork` parameter must be omitted.
	 *
	 * @param container - A reference to the IPC handler container, either `MainProcessHandler` or `ChildProcessHandler`.
	 *                    This object must have a unique `id` to distinguish the dispatcher instance (used for disambiguation
	 *                    when multiple versions of the IPC package coexist).
	 * @param fork - (Optional) A `NodeJS.Process` object representing a child process. Required when used in the main process
	 *               to communicate with a specific forked process. Not needed when called from a child process.
	 *
	 * @throws Error if called from the main process without providing the `fork`, or from a non-forked environment
	 *         without access to `process.send`.
	 */
	constructor(container: MainProcessHandler | ChildProcessHandler, fork?: NodeJS.Process) {
		// If it is the main process, then it is required the fork parameter
		// with which to establish the communication
		if (!process.send && !fork) throw new Error('Invalid parameters');

		this.#container = container;

		this.#process = fork ? fork : process;
		this.#process.on('message', this.#onmessage);
	}

	#pendings = new Map();

	/**
	 * Execute an IPC action
	 *
	 * @param target {string | undefined} The target process where to execute the action
	 * @param action {string} The name of the action being requested
	 * @param params {*} The parameters of the action
	 */
	exec(target: string, action: string, ...params: any[]) {
		if (!process.send && target) {
			// Trying to execute from the main process to the main process
			return Promise.reject(new Error('Parameter target cannot be "main" in this context'));
		}

		const id = randomUUID();
		const promise: PendingPromise<any> = new PendingPromise();

		const rq = {
			type: 'ipc.request',
			ipc: { instance: this.#container.id },
			request: { target, id, action, params }
		};

		this.#pendings.set(id, promise);
		this.#process.send(rq);

		return promise;
	}

	/**
	 * Response reception handler
	 */
	#onmessage = (message: IResponseMessage) => {
		// Assure the message is an IPC response
		if (typeof message !== 'object' || message.type !== 'ipc.response') return;

		// Ignore the message if it was not intended for this IPC instance.
		// This ensures that in environments with multiple IPC versions or instances loaded,
		// only the matching dispatcher processes the response.
		if (this.#container.id !== message.ipc?.instance) return;

		if (!this.#pendings.has(message.request)) {
			console.error('Response message id is invalid', message);
			return;
		}

		// Resolve the pending promise with the response data or reject it with an error
		const pending = this.#pendings.get(message.request);
		if (message.error) {
			pending.reject(new IPCError(message.error));
		} else {
			const { data } = message;
			pending.resolve(data);
		}

		// Remove the pending promise from the map
		this.#pendings.delete(message.request);
	};

	destroy() {
		this.#process.removeListener('message', this.#onmessage);
	}
}
