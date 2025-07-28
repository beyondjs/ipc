import type Server from '..';
import type Dispatcher from '../../../dispatcher';
import type { IRequestMessage, IResponseMessage } from '../../../types';

export default class Listener {
	#fork: NodeJS.Process;
	#server: Server;
	#dispatchers: Map<string, Dispatcher>;

	// The bridge function that allows to execute actions received from a child process
	// and that are executed in another child process
	// The main ipc manager provides the bridge function, as it has the dispatchers
	// to execute actions on the forked processes, and the bridge is the function
	// that knows to which child process is the request being redirected
	#bridge = async (message): Promise<void> => {
		const { target } = message;
		if (!this.#dispatchers.has(target)) {
			return { error: { message: `Target "${message.target}" not found` } };
		}

		const dispatcher = this.#dispatchers.get(target);
		const response = await dispatcher.exec(undefined, message.action, ...message.params);
		return { response };
	};

	constructor(server: Server, fork: NodeJS.Process, dispatchers: Map<string, Dispatcher>) {
		this.#server = server;
		this.#fork = fork;
		this.#dispatchers = dispatchers;
		fork.on('message', this.#onmessage);
	}

	#exec = async (message: IRequestMessage) => {
		const { id } = message;

		const send = ({ response, error }: { response?: any; error?: string }) => {
			const message: IResponseMessage = Object.assign({ response, error }, { type: 'ipc.response', id });
			this.#fork.send(message);
		};

		if (!message.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		if (message.target === 'main') {
			if (!this.#server.has(message.action)) {
				send({ error: { message: `Action "${message.action}" not found` } });
				return;
			}

			let response;
			try {
				response = await this.#server.exec(message.action, ...message.params);
			} catch (exc) {
				send({ error: { message: exc.message, stack: exc.stack } });
				return;
			}
			send({ response });
		} else {
			send(await this.#bridge(message));
		}
	};

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
