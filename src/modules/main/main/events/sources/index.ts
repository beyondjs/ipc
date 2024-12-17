import { ListenersType } from '..';

export default class {
	#sources = new Map();

	// The listeners of the main process
	#listeners: ListenersType;

	constructor(listeners: ListenersType) {
		this.#listeners = listeners;
	}

	// Private method used by the children processes to allow child-child notifications
	emit(sourceName: string, event: string, message: any) {
		// Emit the event to the listeners of the main process
		const key = `${sourceName}|${event}`;
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
		this.#sources.forEach(source => source.emit(sourceName, event, message));
	}

	register(name: string, fork: NodeJS.Process) {
		this.#sources.set(name, new (require('./source'))(this, name, fork));
	}

	destroy() {
		this.#sources.forEach(source => source.destroy());
	}
}
