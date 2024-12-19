import type Dispatcher from '../../../dispatcher';
import type Actions from '../';
import ChildRouter from './child';

export default class {
	#actions: Actions;
	#dispatchers: Map<string, Dispatcher>;

	constructor(actions: Actions, dispatchers: Map<string, Dispatcher>) {
		this.#actions = actions;
		this.#dispatchers = dispatchers;
	}

	#routers: Map<string, ChildRouter> = new Map();

	register(name: string, fork: NodeJS.Process) {
		this.#routers.set(name, new ChildRouter(this.#actions, fork, this.#dispatchers));
	}

	destroy() {
		this.#routers.forEach(listener => listener.destroy());
	}
}
