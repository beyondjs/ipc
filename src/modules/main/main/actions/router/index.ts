import type MainProcessHandler from '../..';
import ChildRouter from './child';

export default class ActionsRouter {
	#main: MainProcessHandler;
	#children: Map<string, ChildRouter> = new Map();

	constructor(main: MainProcessHandler) {
		this.#main = main;
	}

	register(name: string, fork: NodeJS.Process) {
		if (this.#children.has(name)) {
			throw new Error(`Child process "${name}" already registered`);
		}

		const child = new ChildRouter(this.#main, name, fork);
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

	dispatch(target: string, action: string, ...params: any[]): Promise<any> {
		if (!this.#children.has(target)) {
			throw new Error(`Child process "${target}" not found`);
		}

		const child = this.#children.get(target);
		return child.dispatch(action, ...params);
	}

	destroy() {
		this.#children.forEach(child => child.destroy());
		this.#children.clear();
	}
}
