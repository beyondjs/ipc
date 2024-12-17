const IPCServer = require('./server');
const uuid = require('uuid').v4;

module.exports = class extends IPCServer {
	#dispatcher;
	#id = uuid();
	#events = new (require('./events'))();
	get events() {
		return this.#events;
	}

	constructor() {
		super();

		this.#dispatcher = new (require('../dispatcher'))(undefined, this);
	}

	notify(...params) {
		this.#events.emit(...params);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target {string | undefined} The name of the target process
	 * @param action {string} The name of the action being requested
	 * @param params {*} The parameters of the action
	 * @returns {*}
	 */
	async exec(target, action, ...params) {
		return await this.#dispatcher.exec(target, action, ...params);
	}

	destroy() {
		this.#dispatcher.destroy();
		this.#events.destroy();
		super.destroy();
	}
};
