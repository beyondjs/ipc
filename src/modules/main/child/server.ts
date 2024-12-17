import type { IRequest, IResponse, ActionHandlerType } from '../interfaces';

export default class {
	#handlers: Map<string, ActionHandlerType> = new Map();

	handle = (action: string, listener: ActionHandlerType) => this.#handlers.set(action, listener);
	removeHandler = (action: string) => this.#handlers.delete(action);

	constructor() {
		process.on('message', this.#onrequest);
	}

	#exec = async (message: IRequest) => {
		const send = (response: object) => {
			Object.assign(response, <IResponse>{ type: 'ipc.response', request: { id: message.id } });
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

		send({ response: response });
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
