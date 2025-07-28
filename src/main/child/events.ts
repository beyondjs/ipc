import { IListener, IEventEmit, IEventMessage, IEventSubscription } from '../types';

export default class Events {
	#listeners: Map<string, Set<IListener>> = new Map();

	constructor() {
		process.on('message', this.#onmessage);
	}

	emit = (event: string, data: any) => {
		const message: IEventEmit = { type: 'ipc.event.emit', event, data };
		process.send(message);
	};

	on(source: string, event: string, listener: IListener) {
		if (typeof source !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${source}|${event}`;
		if (!this.#listeners.has(key)) {
			// If no listeners are registered for this event, send a message to the main process to register it
			// This allows the main process to know that a child process is interested in this event
			// and to register the listener accordingly
			// This is important for child-child communication
			// as the main process will relay the events to the other children
			// This is done only once per event to avoid unnecessary overhead
			// and to ensure that the main process is aware of the event subscription
			const message: IEventSubscription = {
				type: 'ipc.add.event.listener',
				source: source,
				event: event
			};
			process.send(message);
		}

		let listeners: Set<IListener>;
		if (this.#listeners.has(key)) {
			listeners = this.#listeners.get(key);
		} else {
			listeners = new Set();
			this.#listeners.set(key, listeners);
		}
		listeners.add(listener);
	}

	off(source: string, event: string, listener: IListener) {
		if (typeof source !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${source}|${event}`;

		let listeners;
		if (!this.#listeners.has(key)) {
			console.warn(`No listeners registered with key "${key}"`);
			return;
		}

		listeners = this.#listeners.get(key);
		if (!listeners.has(listener)) {
			console.warn(`The specified listener is not registered with key "${key}"`);
			return;
		}

		listeners.delete(listener);

		if (!listeners.size && this.#listeners.delete(key)) {
			const message: IEventSubscription = { type: 'ipc.remove.event.listener', source: source, event: event };
			process.send(message);
		}
	}

	#onmessage = (message: IEventMessage) => {
		// Validate the message type and structure
		if (typeof message !== 'object' || message.type !== 'ipc.event.dispatch') return;
		if (!message.source || !message.event) {
			console.error('Invalid event message received', message);
			return;
		}

		// Construct the key for the listeners map
		const key = `${message.source}|${message.event}`;
		if (!this.#listeners.has(key)) {
			console.warn(`Received an event with no listeners registered "${key}"`);
			return;
		}

		// Retrieve the listeners for the event and execute them
		const listeners = this.#listeners.get(key);
		listeners.forEach(listener => {
			// Execute the listener
			try {
				listener(message.data);
			} catch (exc) {
				console.error(`Error executing listener of event "${key}"`, exc.stack);
			}
		});
	};

	destroy() {
		process.removeListener('message', this.#onmessage);
	}
}
