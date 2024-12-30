import type Bridges from '.';
import type { IEvent, IC2CSubscribe, IC2CUnsubscribe, IC2CEventRoute } from '../../../interfaces';
import { version } from '../../../interfaces';
import { VersionError } from '../../../error';

export default class {
	#routes: Bridges;
	#tag: string;
	#fork: NodeJS.Process;

	#listeners: Map<string, Set<string>> = new Map();

	constructor(routes: Bridges, tag: string, fork: NodeJS.Process) {
		this.#routes = routes;
		this.#tag = tag;
		this.#fork = fork;

		fork.on('message', this.#onmessage);
	}

	/**
	 * Route the event if the forked process is registered to it.
	 * The execution of this method is expected to be made only by the index.ts file (the routes collection).
	 *
	 * @param processTag The tag of the process that is sending the event
	 * @param event The event name
	 * @param data The data to be sent
	 */
	route(processTag: string, event: string, data: any) {
		const key = `${processTag}|${event}`;
		if (!this.#listeners.has(key)) return;

		try {
			const message: IC2CEventRoute = { version, type: 'ipc.c2c.event.route', processTag, event, data };
			this.#fork.send(message);
		} catch (exc) {
			console.warn(`Error emitting event ${key} to fork process with name "${this.#tag}"`, exc.message);
		}
	}

	#onmessage = (message: IC2CSubscribe | IC2CUnsubscribe | IEvent) => {
		if (typeof message !== 'object') return;
		if (!['ipc.c2c.event.subscribe', 'ipc.c2c.event.unsubscribe', 'ipc.event'].includes(message.type)) return;

		// Check the version of the communication protocol
		if (message.version !== version) {
			const error = new VersionError(message.version);
			console.error(error);
			return;
		}

		if (message.type === 'ipc.c2c.event.subscribe') {
			if (!message.ipc?.instance || !message.processTag || !message.event) {
				console.error('Invalid message of event subscription', message);
				return;
			}

			const key = `${message.processTag}|${message.event}`;
			if (this.#listeners.has(key) && this.#listeners.get(key).has(message.ipc.instance)) {
				console.warn(`Event "${key}" already subscribed`);
				return;
			}

			const instances = this.#listeners.get(key) || new Set();
			instances.add(message.ipc.instance);
			this.#listeners.set(key, instances);
		} else if (message.type === 'ipc.c2c.event.unsubscribe') {
			if (!message.ipc?.instance || !message.processTag || !message.event) {
				console.error('Invalid message of event subscription remove', message);
				return;
			}

			const key = `${message.processTag}|${message.event}`;
			if (!this.#listeners.has(key)) {
				console.warn(`Event "${key}" was not previously subscribed`);
				return;
			}

			const instances = this.#listeners.get(key);
			instances.delete(message.ipc.instance);
			!instances.size && this.#listeners.delete(key);
		} else if (message.type === 'ipc.event') {
			if (!message.event || typeof message.event !== 'string') {
				console.error('Invalid parameters on event emit', message);
				return;
			}

			// This is a method exposed by the routes collection (index.js file)
			// This method will iterate over the routes to dispatch the event to the
			// forked processes that are attached to the event
			this.#routes.route(this.#tag, message.event, message.data);
		}
	};

	destroy() {
		this.#fork.removeListener('message', this.#onmessage);
	}
}
