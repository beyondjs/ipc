import type { MainProcessHandler } from '../..';
import type { IRequestMessage, IResponseMessage } from '@beyond-js/ipc/types';
import type { ChildProcess } from 'child_process';
import { Dispatcher } from '@beyond-js/ipc/dispatcher';
import { SerializableError } from '@beyond-js/ipc/errors';

/**
 * Handles IPC messages received from a specific child process.
 *
 * This class is instantiated once per child process and is responsible for:
 * - Executing actions targeted at the main process.
 * - Forwarding actions to other child processes via a dispatcher.
 *
 * All incoming messages from the child process are listened to via `process.on('message')`,
 * and are filtered to detect `ipc.request` messages. Based on the `target`, the message is either:
 * - Executed locally (in the main process).
 * - Routed to another child process through the dispatchers registry in the main process.
 */
export default class ChildRouter {
	#main: MainProcessHandler;

	// The name of the child process
	#name: string;
	get name() {
		return this.#name;
	}

	// The forked process that this handler is associated with
	#fork: ChildProcess;

	// The dispatcher is used to execute actions that are meant for other child processes
	#dispatcher: Dispatcher;

	constructor(main: MainProcessHandler, name: string, fork: ChildProcess) {
		this.#main = main;
		this.#name = name;
		this.#fork = fork;

		this.#dispatcher = new Dispatcher(fork);
		fork.on('message', this.#onmessage);
	}

	/**
	 * Executes an action in the child process
	 *
	 * @param action {string} The name of the action to execute
	 * @param params {...any[]} The parameters to pass to the action
	 * @returns
	 */
	dispatch(action: string, ...params: any[]): Promise<any> {
		return this.#dispatcher.exec(this.#name, action, ...params);
	}

	/**
	 * Executes and responds an IPC request message targeting the child process.
	 *
	 * @param message {IRequestMessage} The request message to execute
	 */
	async #exec(message: IRequestMessage) {
		const { id, target, action } = message;
		const params = Array.isArray(message.params) ? message.params : [];

		const respond = (data: any) => {
			const response: IResponseMessage = { type: 'ipc.response', request: id, data };
			this.#fork.send(response);
		};

		// Whatever was thrown is the error, a falsy value included: a rejected action never answers as a success
		const fail = (thrown: unknown) => {
			const response: IResponseMessage = { type: 'ipc.response', request: id, error: SerializableError.serialize(thrown) };
			this.#fork.send(response);
		};

		if (!target || !action) {
			const text = `Properties 'target' and 'action' must be set on message "${JSON.stringify(message)}"`;
			return fail(new Error(text));
		}

		// Execute the action in the main process, or dispatch it to another child process
		try {
			const data =
				target === 'main'
					? await this.#main.actions.exec(action, ...params)
					: await this.#main.actions.dispatch(target, action, ...params);
			respond(data);
		} catch (error) {
			fail(error);
		}
	}

	#onmessage = (message: IRequestMessage) => {
		if (typeof message !== 'object' || message === null || message.type !== 'ipc.request') return;
		if (!message.id) {
			// If no id is provided, we cannot respond to this message, so just log an error
			console.error('An undefined message id received on ipc communication', message);
			return;
		}

		this.#exec(message).catch((exc: any) => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		this.#fork.removeListener('message', this.#onmessage);
		this.#dispatcher.destroy();
	}
}
