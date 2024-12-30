import type Dispatcher from '../../dispatcher';
import type { ActionHandlerType } from '../../interfaces';
import Routers from './routers';

export default class {
	#routers: Routers;

	constructor(dispatchers: Map<string, Dispatcher>) {
		this.#routers = new Routers(this, dispatchers);
	}

	#handlers: Map<string, ActionHandlerType> = new Map();

	handle = (action: string, handler: ActionHandlerType) => this.#handlers.set(action, handler);
	off = (action: string) => this.#handlers.delete(action);
	has = (action: string) => this.#handlers.has(action);

	/**
	 * Register a forked process to hear for actions requests
	 *
	 * @param name {string} The name assigned to the forked process
	 * @param fork {object} The forked process
	 */
	registerFork(name: string, fork: NodeJS.Process) {
		this.#routers.register(name, fork);
	}

	async exec(action: string, ...params: any[]) {
		if (!action) throw new Error(`Action parameter must be set`);

		// If this action is not handled, just return, no need to send a response as it is
		// possible that another IPC module is handling this action
		// (this can happen when there are multiple dependencies utilizing different versions of the IPC package)
		if (!this.#handlers.has(action)) return;

		// Execute the action
		const handler = this.#handlers.get(action);
		return await handler(...params);
	}

	destroy() {
		this.#routers.destroy();
	}
}
