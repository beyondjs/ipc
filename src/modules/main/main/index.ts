import { v4 as uuid } from 'uuid';
import Actions from './actions';
import Events from './events';
import Dispatcher from '../dispatcher';

type ListenerType = (...[]) => any;

export default class {
	#dispatchers = new Map();

	/**
	 * The instance of the IPC module exists because a project may have multiple versions
	 * of the IPC package installed, stemming from different project dependencies
	 * requiring different versions of the package.
	 */
	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#actions = new Actions(this.#dispatchers);

	handle(action: string, listener: ListenerType) {
		this.#actions.handle(action, listener);
	}

	removeHandler(action: string) {
		this.#actions.off(action);
	}

	#events = new Events();
	get events() {
		return this.#events;
	}

	notify(event: string, message: any) {
		this.#events.emit(event, message);
	}

	register(name: string, fork: NodeJS.Process) {
		if (!name || !fork) {
			throw new Error('Invalid parameters');
		}

		if (this.#dispatchers.has(name)) {
			throw new Error(`Process "${name}" already registered`);
		}

		this.#dispatchers.set(name, new Dispatcher(this, fork));
		this.#actions.registerFork(name, fork);
		this.#events.registerFork(name, fork);
	}

	unregister(name: string) {
		// Check if forked process was previously registered
		if (!this.#dispatchers.has(name)) throw new Error(`Process ${name} not found`);

		// Unregister the forked process
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
			return await this.#actions.exec(action, ...params);
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
