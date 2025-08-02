import type MainProcessHandler from '..';
import type { IHandler } from '../../types';
import Router from './router';

/**
 * Handles action registration and execution in the main process.
 *
 * This class manages local action handlers and uses the router to:
 * - Dispatch actions to child processes.
 * - Register forked processes for action routing.
 *
 * Actions targeted at the main process are executed locally via `exec`.
 * Actions targeted at child processes are dispatched via `router`.
 */
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
	unhandle = (action: string) => this.#handlers.delete(action);
	off = (action: string) => this.#handlers.delete(action);
	has = (action: string) => this.#handlers.has(action);

	/**
	 * Register a forked child process to enable action routing.
	 *
	 * @param name - Unique name assigned to the forked process.
	 * @param fork - The child process (fork) to register.
	 */
	register(name: string, fork: NodeJS.Process) {
		this.#router.register(name, fork);
	}

	unregister(name: string) {
		this.#router.unregister(name);
	}

	/**
	 * Dispatch an action to a target child process.
	 *
	 * This sends a request to another process via the router and waits for its response.
	 *
	 * @param target - Name of the child process where the action should be executed.
	 * @param action - Name of the action to execute.
	 * @param params - Parameters to pass to the action.
	 * @returns Promise resolving to the result of the action.
	 */
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
