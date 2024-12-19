import type { IC2CSubscribe, IC2CUnsubscribe, IEvent, IC2CEventRoute, EventListenerType } from '../interfaces';
import { version } from '../interfaces';

export default class {
	#listeners: Map<string, Set<EventListenerType>> = new Map();

	constructor() {
		process.on('message', this.#onevent);
	}

	emit(event: string, data: any) {
		process.send(<IEvent>{ type: 'ipc.event', event, data });
	}

	on(processTag: string, event: string, listener: EventListenerType) {
		if (typeof processTag !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${processTag}|${event}`;
		if (!this.#listeners.has(key)) {
			// In order to start receiving this event in a child to child (C2C) communication, it is
			// required to inform the subscription to the main process
			const message: IC2CSubscribe = { version, type: 'ipc.c2c.event.subscribe', processTag, event };
			process.send(message);
		}

		let listeners: Set<EventListenerType>;
		if (this.#listeners.has(key)) {
			listeners = this.#listeners.get(key);
		} else {
			listeners = new Set();
			this.#listeners.set(key, listeners);
		}
		listeners.add(listener);
	}

	off(processTag: string, event: string, listener: EventListenerType) {
		if (typeof processTag !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${processTag}|${event}`;

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

		if (!listeners.size) {
			this.#listeners.delete(key);

			const message: IC2CUnsubscribe = { version, type: 'ipc.c2c.event.unsubscribe', processTag, event };
			process.send(message);
		}
	}

	#onevent = (message: IC2CEventRoute) => {
		// Check if message is an IPC event, otherwise just return
		if (typeof message !== 'object' || message.type !== 'ipc.c2c.event.route') return;
		if (!message.processTag || !message.event) {
			console.error('Invalid event message received', message);
			return;
		}

		const key = `${message.processTag}|${message.event}`;
		if (!this.#listeners.has(key)) {
			console.warn(`Received an event with no listeners registered "${key}"`);
			return;
		}

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
		process.removeListener('message', this.#onevent);
	}
}
