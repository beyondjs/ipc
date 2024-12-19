import type { EventListenerType } from '../../interfaces';
import Routers from './routers';

export default class {
	// Routers of events are the events received from the forked processes
	#routers: Routers;
	#listeners: Map<string, Set<EventListenerType>> = new Map();

	constructor() {
		this.#routers = new Routers();
	}

	/**
	 * Register a listener for an event received from a given child process
	 *
	 * @param child The child process name given when it was registered in the IPC
	 * @param event The event name
	 * @param listener The callback to be executed when the event occurs
	 */
	on(child: string, event: string, listener: EventListenerType) {
		if (typeof child !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		let listeners: Set<EventListenerType>;
		const key = `${child}|${event}`;
		if (this.#listeners.has(key)) {
			listeners = this.#listeners.get(key);
		} else {
			listeners = new Set();
			this.#listeners.set(key, listeners);
		}
		listeners.add(listener);
	}

	/**
	 * Remove a registered event listener
	 *
	 * @param child The child process name given when it was registered in the IPC
	 * @param event The event name
	 * @param listener The previously registered listener function
	 */
	off(child: string, event: string, listener: EventListenerType) {
		const key = `${child}|${event}`;

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
	}

	// To emit events from the main to the forked children and even to the main process
	emit(event: string, data: any) {
		// Emit the event to the listeners of the main process
		const key = `main|${event}`;
		if (this.#listeners.has(key)) {
			const listeners = this.#listeners.get(key);
			listeners.forEach(listener => {
				try {
					listener(data);
				} catch (exc) {
					console.warn(`Error emitting event ${key}`, exc.stack);
				}
			});
		}

		// Emit the events to the children processes
		this.#routers.route('main', event, data);
	}

	/**
	 * Register a fork process to hear for actions requests
	 */
	registerFork = (name: string, fork: NodeJS.Process) => this.#routers.register(name, fork);
}
