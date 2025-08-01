import { IListener } from '../../../types';
import OriginHandler from './origin';

export default class Router {
	#origins: Map<string, OriginHandler> = new Map();

	// The listeners of the main process
	#listeners: Map<string, Set<IListener>>;

	constructor(listeners: Map<string, Set<IListener>>) {
		this.#listeners = listeners;
	}

	emit(origin: string, event: string, message: any) {
		// Emit the event to the listeners of the main process
		const key = `${origin}|${event}`;
		if (this.#listeners.has(key)) {
			const listeners = this.#listeners.get(key);
			listeners.forEach(listener => {
				try {
					listener(message);
				} catch (exc) {
					console.warn(`Error emitting event ${key}`, exc.stack);
				}
			});
		}

		this.#origins.forEach(origin => origin.emit(origin, event, message));
	}

	register(name: string, fork: NodeJS.Process) {
		if (this.#origins.has(name)) {
			throw new Error(`Child process "${name}" already registered`);
		}

		this.#origins.set(name, new OriginHandler(this, name, fork));
	}

	destroy() {
		this.#origins.forEach(origin => origin.destroy());
	}
}
