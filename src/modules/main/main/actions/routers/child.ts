import type Dispatcher from '../../../dispatcher';
import type { IActionRequest, IActionResponse } from '../../../interfaces';
import type Server from '../';
import { version } from '../../../interfaces';
import { VersionError } from '../../../error';

export default class {
	#fork;
	#actions;
	#dispatchers;

	// The route function allows to execute actions received from a child process and that
	// are executed in another child process.
	// The main ipc manager provides the route function, as it has the dispatchers to execute actions
	// on the forked processes, and the route is the function.
	// that knows to which child process is the request being redirected.
	#route = async (message: IActionRequest): Promise<{ error?: string; value?: any }> => {
		const { target } = message;
		if (!this.#dispatchers.has(target)) {
			return { error: `Target "${message.target}" not found` };
		}

		const dispatcher = this.#dispatchers.get(target);
		const value = await dispatcher.exec(undefined, message.action, ...message.params);
		return { value };
	};

	constructor(actions: Server, fork: NodeJS.Process, dispatchers: Map<string, Dispatcher>) {
		this.#actions = actions;
		this.#fork = fork;
		this.#dispatchers = dispatchers;
		fork.on('message', this.#onrequest);
	}

	#exec = async (message: IActionRequest) => {
		const send = ({ error, value }: { error?: string; value?: any }) => {
			const response: IActionResponse = {
				version,
				type: 'ipc.action.response',
				ipc: { instance: message.ipc.instance },
				request: { id: message.id },
				error,
				response: value
			};

			this.#fork.send(response);
		};

		if (!message.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		if (message.target === 'main') {
			if (!this.#actions.has(message.action)) {
				send({ error: `Action "${message.action}" not found` });
				return;
			}

			let value: any;
			try {
				value = await this.#actions.exec(message.action, ...message.params);
			} catch (exc) {
				console.error(exc);
				send({ error: `Error execution IPC action: ${exc.message}` });
				return;
			}
			send({ value });
		} else {
			send(await this.#route(message));
		}
	};

	#onrequest = (request: IActionRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.action.request') return;

		// Check the version of the communication protocol
		if (request.version !== version) {
			const error = new VersionError(request.version);
			console.error(error);
			return;
		}

		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}

		this.#exec(request).catch(exc => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		this.#fork.removeListener('message', this.#onrequest);
	}
}
