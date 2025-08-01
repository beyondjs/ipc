import type { IListener, IHandler, IProcessHandler } from '../types';
import { randomUUID } from 'crypto';
import Actions from './actions';
import Events from './events';

export default class MainProcessHandler implements IProcessHandler {
	#id = randomUUID();
	get id() {
		return this.#id;
	}

	#actions: Actions;
	get actions() {
		return this.#actions;
	}

	handle = (action: string, handler: IHandler) => this.#actions.handle(action, handler);
	removeHandler = (action: string) => this.#actions.off(action);

	constructor() {
		this.#actions = new Actions(this);
	}

	#events = new Events();
	get events() {
		return this.#events;
	}

	on(origin: string, event: string, listener: IListener) {
		this.#events.on(origin, event, listener);
	}

	off(origin: string, event: string, listener: IListener) {
		this.#events.off(origin, event, listener);
	}

	emit(event: string, data: any) {
		this.#events.emit(event, data);
	}

	/**
	 * DEPRECATED: Use `emit` or `events.emit` instead.
	 *
	 * @param event {string} The name of the event to emit
	 * @param data
	 */
	notify(event: string, data: any) {
		this.#events.emit(event, data);
	}

	register(name: string, fork: NodeJS.Process) {
		if (!name || !fork) throw new Error('Invalid parameters');

		this.#actions.registerFork(name, fork);
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
	async exec(target: string, action: string, ...params: any[]): Promise<any> {
		/**
		 * It is possible to execute an action from the main process directly
		 * to an action of the main process itself.
		 */
		if (target === 'main') {
			return await this.#actions.exec(action, ...params);
		} else {
			return await this.#actions.dispatch(target, action, ...params);
		}
	}

	destroy() {
		this.#actions.destroy();
	}
}
