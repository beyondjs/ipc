import type { ChildProcessHandler } from '.';
import type { IHandler, IRequestMessage, IResponseMessage } from '@beyond-js/ipc/types';
import { Dispatcher } from '@beyond-js/ipc/dispatcher';

export default class Actions {
	#handlers: Map<string, IHandler> = new Map();
	#dispatcher: Dispatcher;

	handle = (action: string, handler: IHandler) => this.#handlers.set(action, handler);
	detach = (action: string) => this.#handlers.delete(action);

	constructor(child: ChildProcessHandler) {
		this.#dispatcher = new Dispatcher();
		process.on('message', this.#onmessage);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target {string | undefined} The name of the target process
	 * @param action {string} The name of the action being requested
	 * @param params {*} The parameters of the action
	 */
	async exec(target: string, action: string, ...params: any[]): Promise<any> {
		return await this.#dispatcher.exec(target, action, ...params);
	}

	async #run(message: IRequestMessage): Promise<void> {
		const { id, action, params } = message;

		const respond = ({ data, error }: { data?: any; error?: Error }) => {
			const message: IResponseMessage = {
				type: 'ipc.response',
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
		this.#run(message).catch(exc => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		this.#dispatcher.destroy();
		process.removeListener('message', this.#onmessage);
	}
}
