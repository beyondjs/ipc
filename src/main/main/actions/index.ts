import type MainProcessHandler from '..';
import type { IHandler } from '../../types';
import Dispatcher from '../../dispatcher';
import Router from './router';

export default class Actions {
	#main: MainProcessHandler;
	#handlers: Map<string, IHandler> = new Map();
	#router: Router;

	constructor(main: MainProcessHandler) {
		this.#main = main;
		this.#router = new Router(main);
	}

	handle = (action: string, handler: IHandler) => this.#handlers.set(action, handler);
	off = (action: string) => this.#handlers.delete(action);
	has = (action: string) => this.#handlers.has(action);

	/**
	 * Register a forked process to hear for actions requests
	 *
	 * @param name {string} The name assigned to the forked process
	 * @param fork {object} The forked process
	 */
	registerFork = (name: string, fork: NodeJS.Process) => this.#router.register(name, fork);

	/**
	 * Execute an action whose recipient is the main process
	 *
	 * @param action {string} The name of the action to execute
	 * @param params {...any[]} The parameters to pass to the action
	 * @returns any The response of the action
	 */
	async exec(action: string, ...params: any[]): Promise<any> {
		if (!action) throw new Error(`Action parameter must be set`);
		if (!this.#handlers.has(action)) throw new Error(`Action "${action}" not set`);

		// Execute the action
		return await this.#handlers.get(action)(...params);
	}

	destroy() {
		this.#router.destroy();
	}
}
