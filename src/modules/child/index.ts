import type Dispatcher from '../dispatcher';
import IPCServer from './server';
import { v4 as uuid } from 'uuid';

export default class extends IPCServer {
	#dispatcher: Dispatcher;

	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#events = new (require('./events'))();
	get events() {
		return this.#events;
	}

	constructor() {
		super();

		this.#dispatcher = new (require('../dispatcher'))(undefined, this);
	}

	notify(...params: any[]) {
		this.#events.emit(...params);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target The name of the target process
	 * @param action The name of the action being requested
	 * @param params The parameters of the action
	 * @returns {*}
	 */
	async exec(target: string | undefined, action: string, ...params: any[]): Promise<any> {
		return await this.#dispatcher.exec(target, action, ...params);
	}

	destroy() {
		this.#dispatcher.destroy();
		this.#events.destroy();
		super.destroy();
	}
}
