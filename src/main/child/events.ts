import type { IListener, IEventEmit, IEventMessage, IEventSubscription } from '../types';

/**
 * Manages event communication for a child process in the IPC system.
 *
 * This class allows the child process to:
 * - Subscribe to events emitted by other processes (including, optionally, itself).
 * - Emit events, which are always routed through the main process.
 *
 * Event model
 * ===========
 * Each event is uniquely identified by a combination of:
 * - `origin`: the ID of the process that emits the event.
 * - `event`: the name of the event.
 *
 * Subscriptions are registered using `on(origin, event, listener)`. When the first listener
 * is added for a given key, a subscription message is sent to the main process to let it know
 * this child process is interested in that event. This enables efficient routing without broadcasting
 * to all children.
 *
 * Event emission and routing
 * ==========================
 * Events are emitted using `emit(event, data)`, and are always sent to the main process.
 * The main process then dispatches the event to all subscribed child processes.
 *
 * Child processes in Node.js cannot communicate directly with each other, so the main process
 * acts as a central router for all events.
 *
 * Emitting to self
 * ================
 * While events are always routed through the main process, it is possible for a process to
 * receive events it emitted itself — as long as it has a listener registered for that
 * origin/event combination. This behavior is supported by the routing layer and may be useful
 * in advanced use cases such as debugging.
 *
 * Automatic unsubscription is handled when the last listener for a given event is removed.
 */
export default class Events {
	#listeners: Map<string, Set<IListener>> = new Map();

	constructor() {
		process.on('message', this.#onmessage);
	}

	emit(event: string, data: any): void {
		// Always send to the main process for routing
		const message: IEventEmit = { type: 'ipc.event.emit', event, data };
		process.send(message);
	}

	on(origin: string, event: string, listener: IListener) {
		if (typeof origin !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${origin}|${event}`;
		if (!this.#listeners.has(key)) {
			// If no listeners are registered for this event, send a message to the main process to register it
			// This allows the main process to know that a child process is interested in this event
			// and to register the listener accordingly
			// This is important for child-child communication
			// as the main process will relay the events to the other children
			// This is done only once per event to avoid unnecessary overhead
			// and to ensure that the main process is aware of the event subscription
			const message: IEventSubscription = { type: 'ipc.event.subscribe', origin, event: event };
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

	off(origin: string, event: string, listener: IListener) {
		if (typeof origin !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${origin}|${event}`;

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
			const message: IEventSubscription = { type: 'ipc.event.unsubscribe', origin: origin, event: event };
			process.send(message);
		}
	}

	#onmessage = (message: IEventMessage) => {
		// Validate the message type and structure
		if (typeof message !== 'object' || message.type !== 'ipc.event.dispatch') return;
		if (!message.origin || !message.event) {
			console.error('Invalid event message received', message);
			return;
		}

		// Construct the key for the listeners map
		const key = `${message.origin}|${message.event}`;
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
