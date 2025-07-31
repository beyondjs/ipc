import type { IListener, IHandler } from '../types';
import { v4 as uuid } from 'uuid';
import Server from './server';
import Dispatcher from '../dispatcher';
import Events from './events';

export default class MainProcessHandler {
	#dispatchers: Map<string, Dispatcher> = new Map();

	#id = uuid();
	get id() {
		return this.#id;
	}

	#server = new Server(this.#dispatchers);
	handle = (action: string, handler: IHandler) => this.#server.handle(action, handler);
	removeHandler = (action: string) => this.#server.off(action);

	#events = new Events();
	get events() {
		return this.#events;
	}

	notify(...params) {
		this.#events.emit(...params);
	}

	register(name: string, fork: NodeJS.Process) {
		if (!name || !fork) throw new Error('Invalid parameters');
		if (this.#dispatchers.has(name)) throw new Error(`Process "${name}" already registered`);

		this.#dispatchers.set(name, new Dispatcher(this, fork));
		this.#server.registerFork(name, fork);
		this.#events.registerFork(name, fork);
	}

	unregister(name: string) {
		if (!this.#dispatchers.has(name)) throw new Error(`Process ${name} not found`);
		const dispatcher = this.#dispatchers.get(name);
		dispatcher.destroy();
		this.#dispatchers.delete(name);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target {string | undefined} The name of the target process
	 * @param action {string} The name of the action being requested
	 * @param params The parameters of the action
	 */
	async exec(target: string, action: string, ...params: any[]) {
		if (target === 'main') {
			// It is possible to execute an action from the main process directly
			// to an action of the main process
			return await this.#server.exec(action, ...params);
		}

		if (!this.#dispatchers.has(target)) throw new Error(`Target process "${target}" not found`);

		// Execute the action in one of the registered processes
		const dispatcher = this.#dispatchers.get(target);
		return await dispatcher.exec(undefined, action, ...params);
	}

	destroy() {
		this.#dispatchers.forEach(dispatcher => dispatcher.destroy());
	}
}
