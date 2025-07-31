import type MainProcessHandler from '../..';
import type { IRequestMessage, IResponseMessage } from '../../../types';
import Dispatcher from '../../../dispatcher';

export default class ChildProcessActionsHandler {
	// This is used to execute actions that are meant for the main process
	#main: MainProcessHandler;

	// The forked process that this handler is associated with
	#fork: NodeJS.Process;

	// The dispatcher is used to execute actions that are meant for other child processes
	#dispatcher: Dispatcher;

	constructor(main: MainProcessHandler, fork: NodeJS.Process) {
		this.#fork = fork;

		this.#dispatcher = new Dispatcher(main, fork);
		fork.on('message', this.#onmessage);
	}

	// The router function that allows to execute actions received from a child process
	// and that are executed in another child process
	// The main ipc manager provides the bridge function, as it has the dispatchers
	// to execute actions on the forked processes, and the bridge is the function
	// that knows to which child process is the request being redirected
	#route = async (message: IRequestMessage): Promise<void> => {
		const { target } = message;
		if (!this.#dispatchers.has(target)) {
			return { error: { message: `Target "${message.target}" not found` } };
		}

		const dispatcher = this.#dispatchers.get(target);
		const response = await dispatcher.exec(undefined, message.action, ...message.params);
		return { response };
	};

	async #exec(message: IRequestMessage) {
		const { id } = message;

		const send = ({ response, error }: { response?: any; error?: string }) => {
			const message: IResponseMessage = Object.assign({ type: 'ipc.response', id, response, error });
			this.#fork.send(message);
		};

		if (!message.action) {
			throw new Error(`Property 'action' must be set on message "${JSON.stringify(message)}"`);
		}

		if (message.target === 'main') {
			let response;
			try {
				response = await this.#main.exec(message.action, ...message.params);
			} catch (exc) {
				send({ error: { message: exc.message, stack: exc.stack } });
				return;
			}
			send({ response });
		} else {
			send(await this.#route(message));
		}
	}

	#onmessage = (message: IRequestMessage) => {
		if (typeof message !== 'object' || message.type !== 'ipc.request') return;
		if (!message.id) {
			console.error('An undefined message id received on ipc communication', message);
			return;
		}

		this.#exec(message).catch(exc => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		this.#fork.removeListener('message', this.#onmessage);
	}
}
