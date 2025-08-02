import type { IProcessHandler, IListener } from '../types';
import Actions from './actions';
import { randomUUID } from 'crypto';
import Dispatcher from '../dispatcher';
import Events from './events';

export default class ChildProcessHandler implements IProcessHandler {
	#id = randomUUID();
	get id() {
		return this.#id;
	}

	#dispatcher: Dispatcher;

	#actions: Actions;
	get actions() {
		return this.#actions;
	}

	#events: Events;
	get events() {
		return this.#events;
	}

	constructor() {
		this.#actions = new Actions(this);
		this.#events = new Events();
		this.#dispatcher = new Dispatcher(this);
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

	/**
	 * Execute an IPC action
	 *
	 * @param target {string | undefined} The name of the target process
	 * @param action {string} The name of the action being requested
	 * @param params {*} The parameters of the action
	 */
	async exec(target: string, action: string, ...params: any[]): Promise<any> {
		return await this.#dispatcher.exec(target, action, ...params);
	}

	destroy() {
		this.#dispatcher.destroy();
		this.#events.destroy();
		this.#actions.destroy();
	}
}
