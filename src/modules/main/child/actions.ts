import type ChildProcessHandler from '.';
import { IHandler, IRequestMessage, IResponseMessage } from '../types';

export default class Actions {
	#child: ChildProcessHandler;
	#handlers: Map<string, IHandler> = new Map();

	handle = (action: string, handler: IHandler) => this.#handlers.set(action, handler);
	removeHandler = (action: string) => this.#handlers.delete(action);

	constructor(child: ChildProcessHandler) {
		this.#child = child;
		process.on('message', this.#onmessage);
	}

	async #exec(message: IRequestMessage): Promise<void> {
		const { id, action, params } = message;

		const respond = ({ data, error }: { data?: any; error?: Error }) => {
			const message: IResponseMessage = {
				type: 'ipc.response',
				ipc: { instance: this.#child.id },
				request: id,
				data,
				error: error ? { name: error.name, message: error.message, stack: error.stack } : void 0
			};
			process.send(message);
		};

		if (!action) {
			respond({ error: new Error('Property action must be set') });
			return;
		}

		if (!this.#handlers.has(action)) {
			respond({ error: new Error(`No handler registered for action "${action}"`) });
			return;
		}

		const handler = this.#handlers.get(action);

		let data;
		try {
			data = await handler(...params);
		} catch (error) {
			respond({ error });
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
