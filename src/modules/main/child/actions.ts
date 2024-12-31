import type { IActionRequest, IActionResponse, ActionHandlerType } from '../interfaces';
import { version } from '../interfaces';
import { VersionError } from '../error';

export default class {
	#handlers: Map<string, ActionHandlerType> = new Map();

	handle(action: string, listener: ActionHandlerType) {
		this.#handlers.set(action, listener);
	}

	removeHandler(action: string) {
		return this.#handlers.delete(action);
	}

	constructor() {
		process.on('message', this.#onaction);
	}

	#onaction = (request: IActionRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.action.request') return;

		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}

		const send = ({ value, error }: { value?: object; error?: string }) => {
			const response: IActionResponse = {
				version,
				type: 'ipc.action.response',
				ipc: { instance: request.ipc.instance },
				request: { id: request.id },
				error,
				response: value
			};

			error && console.error(`Error executing action "${request.action}": ${error}`);
			process.send(response);
		};

		if (!request.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		// If this action is not handled, just return, no need to send a response as it is
		// possible that another IPC module is handling this action
		// (this can happen when there are multiple dependencies utilizing different versions of the IPC package)
		if (!this.#handlers.has(request.action)) return;

		// Check the version of the communication protocol
		if (request.version !== version) {
			const error = new VersionError(request.version);
			console.error(error);
			return;
		}

		const handler = this.#handlers.get(request.action);
		Promise.resolve(handler(...request.params))
			.then((value: any) => send({ value }))
			.catch((exc: Error) => send({ error: exc.message }));
	};

	destroy() {
		process.removeListener('message', this.#onaction);
	}
}
