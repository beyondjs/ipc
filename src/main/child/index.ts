import IPCServer from './server';
import { v4 as uuid } from 'uuid';
import Dispatcher from '../dispatcher';
import Events from './events';

export default class ChildProcessHandler extends IPCServer {
	#id = uuid();
	get id() {
		return this.#id;
	}

	#dispatcher: Dispatcher;

	#events = new Events();
	get events() {
		return this.#events;
	}

	constructor() {
		super();
		this.#dispatcher = new Dispatcher(this);
	}

	notify(...params: any[]) {
		this.#events.emit(...params);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target {string | undefined} The name of the target process
	 * @param action {string} The name of the action being requested
	 * @param params {*} The parameters of the action
	 */
	async exec(target: string, action: string, ...params: any[]) {
		return await this.#dispatcher.exec(target, action, ...params);
	}

	destroy() {
		this.#dispatcher.destroy();
		this.#events.destroy();
		super.destroy();
	}
}
