import { IHandler, IRequestMessage, IResponseMessage } from '../types';

export default class Actions {
	#handlers: Map<string, IHandler> = new Map();

	handle = (action: string, handler: IHandler) => this.#handlers.set(action, handler);
	removeHandler = (action: string) => this.#handlers.delete(action);

	constructor() {
		process.on('message', this.#onmessage);
	}

	async #exec(message: IRequestMessage): Promise<void> {
		const { id, action, params } = message;

		const respond = (data: any) => {
			const response: IResponseMessage = { type: 'ipc.response', request: id };
			process.send(response);
		};

		if (!action) {
			respond({ error: 'Property action must be set' });
			return;
		}

		if (!this.#handlers.has(action)) {
			respond({ error: `No handler registered for action "${action}"` });
			return;
		}

		const handler = this.#handlers.get(message.action);

		let data;
		try {
			data = await handler(...message.params);
		} catch (exc) {
			respond({ error: { message: exc.message, stack: exc.stack } });
			return;
		}

		respond({ data });
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
