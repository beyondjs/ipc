import type Dispatcher from '../../../dispatcher';
import type Server from '../';
import Listener from './listener';

export default class {
	#server: Server;
	#dispatchers: Map<string, Dispatcher>;

	constructor(server: Server, dispatchers: Map<string, Dispatcher>) {
		this.#server = server;
		this.#dispatchers = dispatchers;
	}

	#listeners = new Map();

	register(name: string, fork: NodeJS.Process) {
		this.#listeners.set(name, new Listener(this.#server, fork, this.#dispatchers));
	}

	destroy() {
		this.#listeners.forEach(listener => listener.destroy());
	}
}
