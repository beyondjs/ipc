import type { IRequest, IResponse } from '../interfaces';
import { PendingPromise } from '@beyond-js/pending-promise/main';
import IPCError from '../error';

export default class {
	// The process on which the actions will be executed
	#process: NodeJS.Process;
	#container: { instance: string };

	constructor(container: { instance: string }, fork: NodeJS.Process) {
		// If it is the main process, then it is required the fork parameter
		// with which to establish the communication
		if (!process.send && !fork) throw new Error('Invalid parameters');
		this.#container = container;
		this.#process = fork ? fork : process;
		this.#process.on('message', this.#onresponse);
	}

	#IPCError = IPCError;

	#id = 0;
	#pendings = new Map();

	/**
	 * Execute an IPC action
	 */
	exec(target: string | undefined, action: string, ...params: any[]): Promise<any> {
		if (!process.send && target) {
			// Trying to execute from the main process to the main process
			return Promise.reject(new this.#IPCError('Parameter target cannot be "main" in this context'));
		}

		const id = ++this.#id;
		const promise = new PendingPromise();

		const rq: IRequest = {
			type: 'ipc.request',
			ipc: { instance: this.#container.instance },
			target,
			id,
			action,
			params
		};

		this.#pendings.set(id, promise);
		this.#process.send(rq);

		return promise;
	}

	/**
	 * Response reception handler
	 */
	#onresponse = (message: IResponse) => {
		// Check if message is an IPC response, otherwise just return
		if (typeof message !== 'object' || message.type !== 'ipc.response') return;

		if (this.#container.instance !== message.ipc?.instance) return;
		if (!this.#pendings.has(message.request.id)) {
			console.error('Response message id is invalid', message);
			return;
		}

		const pending = this.#pendings.get(message.request.id);
		const { response, error } = message;
		error && console.error(error instanceof Error && error.stack ? error.stack : error);
		error ? pending.reject(new this.#IPCError(error)) : pending.resolve(response);

		this.#pendings.delete(message.request.id);
	};

	destroy() {
		this.#process.removeListener('message', this.#onresponse);
	}
}
