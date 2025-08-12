import type Router from '.';
import type { ChildProcess } from 'child_process';
import type { IEventSubscription, IEventRoute, IEventDispatch } from '@beyond-js/ipc/types';

export default class OriginHandler {
	#router: Router;
	#name: string;
	#fork: ChildProcess;

	#listeners = new Set();

	constructor(router: Router, name: string, fork: ChildProcess) {
		this.#router = router;
		this.#name = name;
		this.#fork = fork;

		fork.on('message', this.#onmessage);
	}

	/**
	 * Dispatch the event if the forked process is registered to it
	 * The execution of this method is made by the router
	 *
	 * @param origin {string} The name of the process that is sending the event
	 * @param event {string} The event name
	 * @param message {*} The message to be sent
	 */
	emit(origin: string, event: string, data: any): void {
		const key = `${origin}|${event}`;
		if (!this.#listeners.has(key)) return;

		try {
			const message: IEventDispatch = { type: 'ipc.event.dispatch', origin, event, data };
			this.#fork.send(message);
		} catch (exc) {
			console.warn(`Error emitting event ${key} to fork process with name "${this.#name}"`, exc.message);
		}
	}

	#onmessage = (message: IEventSubscription | IEventRoute) => {
		if (typeof message !== 'object') return;

		if (message.type === 'ipc.event.subscribe') {
			if (!message.origin || !message.event) {
				console.error('Invalid message of event subscription', message);
				return;
			}

			const key = `${message.origin}|${message.event}`;
			if (this.#listeners.has(key)) {
				console.warn(`Event "${key}" already subscribed`);
				return;
			}

			this.#listeners.add(key);
		} else if (message.type === 'ipc.event.unsubscribe') {
			if (!message.origin || !message.event) {
				console.error('Invalid message of event subscription remove', message);
				return;
			}

			const key = `${message.origin}|${message.event}`;
			if (!this.#listeners.has(key)) {
				console.warn(`Event "${key}" was not previously subscribed`);
				return;
			}

			this.#listeners.add(key);
		} else if (message.type === 'ipc.event.route') {
			if (!message.event || typeof message.event !== 'string') {
				console.error('Invalid parameters on event routing', message);
				return;
			}

			// This method will iterate over the origins to dispatch the event to the
			// forked processes that are attached to the event
			this.#router.emit(this.#name, message.event, message.data);
		}
	};

	destroy() {
		this.#fork.removeListener('message', this.#onmessage);
	}
}
