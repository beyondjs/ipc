import { IHandler, IRequestMessage } from '../types';

export default class Actions {
	#handlers: Map<string, IHandler> = new Map();

	handle = (action: string, handler: IHandler) => this.#handlers.set(action, handler);
	removeHandler = (action: string) => this.#handlers.delete(action);

	constructor() {
		process.on('message', this.#onmessage);
	}

	async #exec(message: IRequestMessage): Promise<void> {
		const send = (response: any) => {
			Object.assign(response, { type: 'ipc.response', id: message.id });
			process.send(response);
		};

		if (!message.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		if (!this.#handlers.has(message.action)) {
			send({ error: `Handler of action "${message.action}" not found` });
			return;
		}

		const handler = this.#handlers.get(message.action);

		let response;
		try {
			response = await handler(...message.params);
		} catch (exc) {
			send({ error: { message: exc.message, stack: exc.stack } });
			return;
		}

		send({ response });
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
		process.removeListener('message', this.#onmessage);
	}
}
