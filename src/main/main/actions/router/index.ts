import type MainProcessHandler from '../..';
import type Dispatcher from '../../../dispatcher';
import ChildProcessActionsHandler from './child';

export default class ServerListeners {
	#main: MainProcessHandler;
	#children: Map<string, ChildProcessActionsHandler> = new Map();

	constructor(main: MainProcessHandler) {
		this.#main = main;
	}

	register(name: string, fork: NodeJS.Process) {
		const child = new ChildProcessActionsHandler(this.#main, fork);
		this.#children.set(name, child);
	}

	unregister(name: string) {
		if (!this.#children.has(name)) {
			throw new Error(`Child process "${name}" not found`);
		}

		const child = this.#children.get(name);
		child.destroy();
		this.#children.delete(name);
	}

	destroy() {
		this.#children.forEach(child => child.destroy());
		this.#children.clear();
	}
}
