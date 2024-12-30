import Dispatcher from '../dispatcher';
import Actions from './actions';
import { v4 as uuid } from 'uuid';
import Events from './events';

export default class extends Actions {
	#dispatcher: Dispatcher;

	/**
	 * The instance of the IPC module exists because a project may have multiple versions
	 * of the IPC package installed, stemming from different project dependencies
	 * requiring different versions of the package.
	 */
	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#events = new Events(this);
	get events() {
		return this.#events;
	}

	constructor() {
		super();
		this.#dispatcher = new Dispatcher(this, undefined);
	}

	notify(event: string, message: any) {
		this.#events.emit(event, message);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target The name of the target process
	 * @param action The nam	e of the action being requested
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
