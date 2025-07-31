import { IListener } from '../../../types';
import OriginHandler from './origin';

export default class Router {
	#origins: Map<string, OriginHandler> = new Map();

	// The listeners of the main process
	#listeners: Map<string, Set<IListener>>;

	constructor(listeners: Map<string, Set<IListener>>) {
		this.#listeners = listeners;
	}

	// Private method used by the children processes to allow child-child notifications
	emit(originName: string, event: string, message: any) {
		// Emit the event to the listeners of the main process
		const key = `${originName}|${event}`;
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

		// Emit the events to the children processes
		this.#origins.forEach(origin => origin.emit(originName, event, message));
	}

	register(name: string, fork: NodeJS.Process) {
		this.#origins.set(name, new OriginHandler(this, name, fork));
	}

	destroy() {
		this.#origins.forEach(origin => origin.destroy());
	}
}
