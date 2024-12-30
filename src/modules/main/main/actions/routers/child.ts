import type Dispatcher from '../../../dispatcher';
import type { IActionRequest, IActionResponse } from '../../../interfaces';
import type Routers from '../';
import { version } from '../../../interfaces';
import { VersionError } from '../../../error';

export default class {
	#fork: NodeJS.Process;
	#routers: Routers;
	#dispatchers: Map<string, Dispatcher>;

	constructor(routers: Routers, fork: NodeJS.Process, dispatchers: Map<string, Dispatcher>) {
		this.#routers = routers;
		this.#fork = fork;
		this.#dispatchers = dispatchers;
		fork.on('message', this.#onrequest);
	}

	#onrequest = (request: IActionRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.action.request') return;

		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}

		const respond = ({ error, value }: { error?: string; value?: any }) => {
			const response: IActionResponse = {
				version,
				type: 'ipc.action.response',
				ipc: { instance: request.ipc.instance },
				request: { id: request.id },
				error,
				response: value
			};

			this.#fork.send(response);
		};

		if (!request.action) {
			respond({ error: 'Property action is undefined' });
			return;
		}

		if (request.target === 'main') {
			if (!this.#routers.has(request.action)) {
				respond({ error: `Action "${request.action}" not found` });
				return;
			}

			this.#routers
				.exec(request.action, ...request.params)
				.then((value: any) => {
					respond({ value });
				})
				.catch((exc: Error) => {
					console.error(exc);
					respond({ error: `Error execution IPC action: ${exc.message}` });
					return;
				});
		} else {
			/**
			 * Execute the action in a child-to-child interprocess communication.
			 */
			const { target } = request;
			if (!this.#dispatchers.has(target)) {
				const error =
					`Error executing a child-to-child action execution.\n` +
					`Target process "${request.target}" not found`;
				return { error };
			}

			const dispatcher = this.#dispatchers.get(target);
			dispatcher.exec(undefined, request.action, ...request.params).then(respond);
		}
	};

	destroy() {
		this.#fork.removeListener('message', this.#onrequest);
	}
}
