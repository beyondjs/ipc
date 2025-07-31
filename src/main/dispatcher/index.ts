import type MainProcessHandler from '../main';
import type ChildProcessHandler from '../child';
import type { IResponseMessage } from '../types';
import IPCError from '../error';
import { PendingPromise } from '@beyond-js/pending-promise/main';

export default class Dispatcher {
	#process: NodeJS.Process;

	// Can be the main process or a child process handler
	#container: MainProcessHandler | ChildProcessHandler;

	/**
	 * Create a new IPC dispatcher
	 *
	 * @param {*} fork
	 * @param {*} container the ipc object.
	 */
	constructor(container: MainProcessHandler | ChildProcessHandler, fork: NodeJS.Process) {
		// If it is the main process, then it is required the fork parameter
		// with which to establish the communication
		if (!process.send && !fork) throw new Error('Invalid parameters');

		this.#container = container;

		this.#process = fork ? fork : process;
		this.#process.on('message', this.#onmessage);
	}

	#id = 0;
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
			return Promise.reject(new IPCError('Parameter target cannot be "main" in this context'));
		}

		const id = ++this.#id;
		const promise = new PendingPromise();
		promise.id = id;

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
		if (typeof message !== 'object' || message.request?.type !== 'ipc.response') return;
		if (this.#container.id !== message.ipc?.instance) return;
		if (!this.#pendings.has(message.request.id)) {
			console.error('Response message id is invalid', message);
			return;
		}

		const pending = this.#pendings.get(message.request.id);
		const { response, error } = message;
		error && console.error(error instanceof Error || error.stack ? error.stack : error);
		error ? pending.reject(new IPCError(error)) : pending.resolve(response);

		this.#pendings.delete(message.request.id);
	};

	destroy() {
		this.#process.removeListener('message', this.#onmessage);
	}
}
