import type { IRequest, IResponse, ActionHandlerType } from '../interfaces';

export default class {
	#handlers: Map<string, ActionHandlerType> = new Map();

	handle = (action: string, listener: ActionHandlerType) => this.#handlers.set(action, listener);
	removeHandler = (action: string) => this.#handlers.delete(action);

	constructor() {
		process.on('message', this.#onrequest);
	}

	#exec = async (request: IRequest) => {
		const send = ({ value, error }: { value?: object; error?: string }) => {
			const response: IResponse = {
				type: 'ipc.response',
				ipc: { instance: request.ipc.instance },
				request: { id: request.id },
				error,
				response: value
			};

			process.send(response);
		};

		if (!request.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		if (!this.#handlers.has(request.action)) {
			send({ error: `Handler of action "${request.action}" not found` });
			return;
		}

		const handler = this.#handlers.get(request.action);

		let value;
		try {
			value = await handler(...request.params);
		} catch (exc) {
			console.error(exc);
			send({ error: exc.message });
			return;
		}

		send({ value });
	};

	#onrequest = (request: IRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.request') return;
		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}
		this.#exec(request).catch(exc => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		process.removeListener('message', this.#onrequest);
	}
}
