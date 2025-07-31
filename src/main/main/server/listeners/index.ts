import type Server from '..';
import type Dispatcher from '../../../dispatcher';
import Listener from './listener';

export default class ServerListeners {
	#server: Server;
	#dispatchers: Map<string, Dispatcher>;
	#listeners: Map<string, Listener> = new Map();

	constructor(server: Server, dispatchers: Map<string, Dispatcher>) {
		this.#server = server;
		this.#dispatchers = dispatchers;
	}

	register = (name: string, fork: NodeJS.Process) =>
		this.#listeners.set(name, new Listener(this.#server, fork, this.#dispatchers));

	destroy() {
		this.#listeners.forEach(listener => listener.destroy());
	}
}
