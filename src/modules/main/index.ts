import { v4 as uuid } from 'uuid';
import Server from './server';
import Events from './events';

type ListenerType = (...[]) => any;

export default class {
	#dispatchers = new Map();

	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#server = new Server(this.#dispatchers);
	handle = (action: string, listener: ListenerType) => this.#server.handle(action, listener);
	removeHandler = (action: string) => this.#server.off(action);

	#events = new Events();
	get events() {
		return this.#events;
	}

	notify(...params: any[]) {
		this.#events.emit(...params);
	}

	register(name: string, fork: NodeJS.Process) {
		if (!name || !fork) {
			throw new Error('Invalid parameters');
		}

		if (this.#dispatchers.has(name)) {
			throw new Error(`Process "${name}" already registered`);
		}

		this.#dispatchers.set(name, new (require('../dispatcher'))(fork, this));
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
	 */
	async exec(target: string | undefined, action: string, ...params: any[]): Promise<any> {
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
