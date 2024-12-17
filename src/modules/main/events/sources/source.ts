import type Sources from '.';

interface IEventDispatchMessage {
	type: 'ipc.event.dispatch';
	source: string;
	event: string;
	message: any;
}

export default class {
	#sources: Sources;
	#name: string;
	#fork: NodeJS.Process;

	#listeners = new Set();

	constructor(sources: Sources, name: string, fork: NodeJS.Process) {
		this.#sources = sources;
		this.#name = name;
		this.#fork = fork;

		fork.on('message', this.#onmessage);
	}

	/**
	 * Dispatch the event if the forked process is registered to it
	 * The execution of this method is made by the index.js file (the sources collection)
	 *
	 * @param sourceName The name of the process that is sending the event
	 * @param event The event name
	 * @param message The message to be sent
	 */
	emit(sourceName: string, event: string, message: any) {
		const key = `${sourceName}|${event}`;
		if (!this.#listeners.has(key)) return;

		try {
			this.#fork.send(<IEventDispatchMessage>{ type: 'ipc.event.dispatch', source: sourceName, event, message });
		} catch (exc) {
			console.warn(`Error emitting event ${key} to fork process with name "${this.#name}"`, exc.message);
		}
	}

	#onmessage = message => {
		if (typeof message !== 'object') return;

		if (message.type === 'ipc.add.event.listener') {
			if (!message.source || !message.event) {
				console.error('Invalid message of event subscription', message);
				return;
			}

			const key = `${message.source}|${message.event}`;
			if (this.#listeners.has(key)) {
				console.warn(`Event "${key}" already subscribed`);
				return;
			}

			this.#listeners.add(key);
		} else if (message.type === 'ipc.remove.event.listener') {
			if (!message.source || !message.event) {
				console.error('Invalid message of event subscription remove', message);
				return;
			}

			const key = `${message.source}|${message.event}`;
			if (!this.#listeners.has(key)) {
				console.warn(`Event "${key}" was not previously subscribed`);
				return;
			}

			this.#listeners.add(key);
		} else if (message.type === 'ipc.event.emit') {
			if (!message.event || typeof message.event !== 'string') {
				console.error('Invalid parameters on event emit', message);
				return;
			}

			// This is a method exposed by the sources collection (index.js file)
			// This method will iterate over the sources to dispatch the event to the
			// forked processes that are attached to the event
			this.#sources.emit(this.#name, message.event, message.message);
		}
	};

	destroy() {
		this.#fork.removeListener('message', this.#onmessage);
	}
}
