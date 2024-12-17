import type { EventListenerType, IEventEmit } from '../../interfaces';
import Sources from './sources';

export type ListenersType = Map<string, Set<EventListenerType>>;

export default class {
	// Sources of events are the events received from the forked processes
	#sources: Sources;
	#listeners: ListenersType = new Map();

	constructor() {
		this.#sources = new Sources(this.#listeners);
	}

	on(source: string, event: string, listener: EventListenerType) {
		if (typeof source !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		let listeners: Set<EventListenerType>;
		const key = `${source}|${event}`;
		if (this.#listeners.has(key)) {
			listeners = this.#listeners.get(key);
		} else {
			listeners = new Set();
			this.#listeners.set(key, listeners);
		}
		listeners.add(listener);
	}

	off(source: string, event: string, listener: EventListenerType) {
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
	}

	// To emit events from the main to the forked children and even to the main process
	emit(event: string, message: IEventEmit) {
		this.#sources.emit('main', event, message);
	}

	/**
	 * Register a fork process to hear for actions requests
	 */
	registerFork = (name: string, fork: NodeJS.Process) => this.#sources.register(name, fork);
}
