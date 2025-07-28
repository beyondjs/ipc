import type Dispatcher from '../../dispatcher';
import { IHandler } from '../../types';

export default class Server {
	// Listeners of the forked processes messages
	#listeners;

	constructor(dispatchers: Map<string, Dispatcher>) {
		this.#listeners = new (require('./listeners'))(this, dispatchers);
	}

	#handlers: Map<string, IHandler> = new Map();

	handle = (action: string, handler: IHandler) => this.#handlers.set(action, handler);
	off = (action: string) => this.#handlers.delete(action);
	has = (action: string) => this.#handlers.has(action);

	/**
	 * Register a forked process to hear for actions requests
	 *
	 * @param name {string} The name assigned to the forked process
	 * @param fork {object} The forked process
	 */
	registerFork = (name: string, fork: NodeJS.Process) => this.#listeners.register(name, fork);

	async exec(action: string, ...params: any[]): Promise<any> {
		if (!action) throw new Error(`Action parameter must be set`);
		if (!this.#handlers.has(action)) throw new Error(`Action "${action}" not set`);

		// Execute the action
		return await this.#handlers.get(action)(...params);
	}

	destroy() {
		this.#listeners.destroy();
	}
}
