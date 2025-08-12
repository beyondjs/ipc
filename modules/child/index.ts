import type { IProcessHandler, IListener } from '@beyond-js/ipc/types';
import Actions from './actions';
import Events from './events';

if (!process.send) {
	console.warn(
		'Warning:\nBeyondJS IPC: This module is designed to be used in a child process context.\n' +
			'If you are seeing this message, it may indicate that the IPC system is being used incorrectly.'
	);
}

export class ChildProcessHandler implements IProcessHandler {
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
	handle(action: string, callback: (message: any) => any) {
		this.#actions.handle(action, callback);
	}
	detach(action: string) {
		this.#actions.detach(action);
	}

	exec(target: string, action: string, ...params: any[]): Promise<any> {
		return this.#actions.exec(target, action, ...params);
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

	destroy() {
		this.#events.destroy();
		this.#actions.destroy();
	}
}

export /*bundle*/ const ipc = new ChildProcessHandler();
