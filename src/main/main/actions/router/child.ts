import type MainProcessHandler from '../..';
import type { IRequestMessage, IResponseMessage, ErrorResponseType } from '../../../types';
import Dispatcher from '../../../dispatcher';

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
	#fork: NodeJS.Process;

	// The dispatcher is used to execute actions that are meant for other child processes
	#dispatcher: Dispatcher;

	constructor(main: MainProcessHandler, name: string, fork: NodeJS.Process) {
		this.#main = main;
		this.#name = name;
		this.#fork = fork;

		this.#dispatcher = new Dispatcher(main, fork);
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
		const { id, target, action, params } = message;

		const respond = ({ data, error }: { data?: any; error?: Error }) => {
			const message: IResponseMessage = {
				type: 'ipc.response',
				ipc: { instance: this.#main.id },
				request: id,
				data,
				error: error ? { name: error.name, message: error.message, stack: error.stack } : void 0
			};
			this.#fork.send(message);
		};

		if (!target || !action) {
			const text = `Properties 'target' and 'action' must be set on message "${JSON.stringify(message)}"`;
			const error = new Error(text);
			respond({ error });
			return;
		}

		// Check if the target is the main process or another child process
		if (target === 'main') {
			// Execute the action in the main process
			try {
				const data = await this.#main.actions.exec(action, ...params);
				respond({ data });
			} catch (error) {
				respond({ error });
				return;
			}
		} else {
			// Dispatch the action to another child process
			try {
				const data = await this.#main.actions.dispatch(target, action, ...params);
				respond({ data });
			} catch (error) {
				respond({ error });
			}
		}
	}

	#onmessage = (message: IRequestMessage) => {
		if (typeof message !== 'object' || message.type !== 'ipc.request') return;
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
