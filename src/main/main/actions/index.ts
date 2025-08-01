import type MainProcessHandler from '..';
import type { IHandler } from '../../types';
import Router from './router';

export default class Actions {
	// The handlers map is used to store the actions of the main process
	#handlers: Map<string, IHandler> = new Map();

	#router: Router;
	get router() {
		return this.#router;
	}

	constructor(main: MainProcessHandler) {
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

	async dispatch(target: string, action: string, ...params: any[]): Promise<any> {
		return await this.#router.dispatch(target, action, ...params);
	}

	/**
	 * Execute an action whose recipient is the main process
	 *
	 * @param action {string} The name of the action to execute
	 * @param params {...any[]} The parameters to pass to the action
	 * @returns any The response of the action
	 */
	async exec(action: string, ...params: any[]): Promise<any> {
		if (!action) throw new Error(`Invalid parameters: 'action' is required`);
		if (!this.#handlers.has(action)) throw new Error(`No handler registered for action "${action}"`);

		return await this.#handlers.get(action)(...params);
	}

	destroy() {
		this.#router.destroy();
	}
}
