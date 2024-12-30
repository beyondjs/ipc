/**
 * File: main/child/actions.ts
 */
import type { IActionRequest, IActionResponse, ActionHandlerType } from '../interfaces';
import { version } from '../interfaces';
import { VersionError } from '../error';

export default class {
	#handlers: Map<string, ActionHandlerType> = new Map();

	handle(action: string, listener: ActionHandlerType) {
		this.#handlers.set(action, listener);
	}

	removeHandler(action: string) {
		return this.#handlers.delete(action);
	}

	constructor() {
		process.on('message', this.#onaction);
	}

	#onaction = (request: IActionRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.action.request') return;

		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}

		const send = ({ value, error }: { value?: object; error?: string }) => {
			const response: IActionResponse = {
				version,
				type: 'ipc.action.response',
				ipc: { instance: request.ipc.instance },
				request: { id: request.id },
				error,
				response: value
			};

			error && console.error(`Error executing action "${request.action}": ${error}`);
			process.send(response);
		};

		if (!request.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		// If this action is not handled, just return, no need to send a response as it is
		// possible that another IPC module is handling this action
		// (this can happen when there are multiple dependencies utilizing different versions of the IPC package)
		if (!this.#handlers.has(request.action)) return;

		// Check the version of the communication protocol
		if (request.version !== version) {
			const error = new VersionError(request.version);
			console.error(error);
			return;
		}

		const handler = this.#handlers.get(request.action);
		handler(...request.params)
			.then((value: any) => send({ value }))
			.catch((exc: Error) => send({ error: exc.message }));
	};

	destroy() {
		process.removeListener('message', this.#onaction);
	}
}

/**
 * File: main/child/events.ts
 */
import type Child from '.';
import type { IC2CSubscribe, IC2CUnsubscribe, IEvent, IC2CEventRoute, EventListenerType } from '../interfaces';
import { version } from '../interfaces';
import { VersionError } from '../error';

export default class {
	#child: Child;
	#listeners: Map<string, Set<EventListenerType>> = new Map();

	constructor(child: Child) {
		this.#child = child;
		process.on('message', this.#onevent);
	}

	emit(event: string, data: any) {
		process.send(<IEvent>{ type: 'ipc.event', event, data });
	}

	/**
	 * Add an event listener
	 *
	 * @param processTag The process tag
	 * @param event The event name
	 * @param listener The event listener
	 */
	on(processTag: string, event: string, listener: EventListenerType) {
		if (typeof processTag !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${processTag}|${event}`;
		if (!this.#listeners.has(key)) {
			// In order to start receiving this event in a child to child (C2C) communication, it is
			// required to inform the subscription to the main process
			const message: IC2CSubscribe = {
				version,
				type: 'ipc.c2c.event.subscribe',
				ipc: { instance: this.#child.instance },
				processTag,
				event
			};
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

	/**
	 * Remove an event listener
	 *
	 * @param processTag The process tag
	 * @param event The event name
	 * @param listener The event listener
	 */
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

			const message: IC2CUnsubscribe = {
				version,
				type: 'ipc.c2c.event.unsubscribe',
				ipc: { instance: this.#child.instance },
				processTag,
				event
			};
			process.send(message);
		}
	}

	/**
	 * Event message reception
	 *
	 * @param message
	 * @returns
	 */
	#onevent = (message: IC2CEventRoute) => {
		// Check if message is an IPC event, otherwise just return
		if (typeof message !== 'object' || message.type !== 'ipc.c2c.event.route') return;

		// Check the version of the communication protocol
		if (message.version !== version) {
			const error = new VersionError(message.version);
			console.error(error);
			return;
		}

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

/**
 * File: main/child/index.ts
 */
import Dispatcher from '../dispatcher';
import Actions from './actions';
import { v4 as uuid } from 'uuid';
import Events from './events';

export default class extends Actions {
	#dispatcher: Dispatcher;

	/**
	 * The instance of the IPC module exists because a project may have multiple versions
	 * of the IPC package installed, stemming from different project dependencies
	 * requiring different versions of the package.
	 */
	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#events = new Events(this);
	get events() {
		return this.#events;
	}

	constructor() {
		super();
		this.#dispatcher = new Dispatcher(this, undefined);
	}

	notify(event: string, message: any) {
		this.#events.emit(event, message);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target The name of the target process
	 * @param action The nam	e of the action being requested
	 * @param params The parameters of the action
	 * @returns {*}
	 */
	async exec(target: string | undefined, action: string, ...params: any[]): Promise<any> {
		return await this.#dispatcher.exec(target, action, ...params);
	}

	destroy() {
		this.#dispatcher.destroy();
		this.#events.destroy();
		super.destroy();
	}
}

/**
 * File: main/dispatcher/index.ts
 */
import type { IActionRequest, IActionResponse } from '../interfaces';
import { version } from '../interfaces';
import { PendingPromise } from '@beyond-js/pending-promise/main';
import IPCError from '../error';

export default class {
	// The process on which the actions will be executed
	#process: NodeJS.Process;
	#container: { instance: string };

	constructor(container: { instance: string }, fork: NodeJS.Process) {
		// If it is the main process, then it is required the fork parameter
		// with which to establish the communication
		if (!process.send && !fork) throw new Error('Invalid parameters');
		this.#container = container;
		this.#process = fork ? fork : process;
		this.#process.on('message', this.#onresponse);
	}

	#IPCError = IPCError;

	#id = 0;
	#pendings = new Map();

	/**
	 * Execute an IPC action
	 */
	exec(target: string | undefined, action: string, ...params: any[]): Promise<any> {
		if (!process.send && target) {
			// Trying to execute from the main process to the main process
			return Promise.reject(new this.#IPCError('Parameter target cannot be "main" in this context'));
		}

		const id = ++this.#id;
		const promise = new PendingPromise();

		const rq: IActionRequest = {
			version,
			type: 'ipc.action.request',
			ipc: { instance: this.#container.instance },
			target,
			id,
			action,
			params
		};

		this.#pendings.set(id, promise);
		this.#process.send(rq);

		return promise;
	}

	/**
	 * Response reception handler
	 */
	#onresponse = (message: IActionResponse) => {
		// Check if message is an IPC response, otherwise just return
		if (typeof message !== 'object' || message.type !== 'ipc.action.response') return;

		// Check if the message is from the same instance
		if (this.#container.instance !== message.ipc?.instance) return;
		if (!this.#pendings.has(message.request.id)) {
			console.error('Response message id is invalid', message);
			return;
		}

		const pending = this.#pendings.get(message.request.id);
		const { response, error } = message;
		error && console.error(error instanceof Error && error.stack ? error.stack : error);
		error ? pending.reject(new this.#IPCError(error)) : pending.resolve(response);

		this.#pendings.delete(message.request.id);
	};

	destroy() {
		this.#process.removeListener('message', this.#onresponse);
	}
}

/**
 * File: main/error.ts
 */
import { version } from './interfaces';

export default class extends Error {
	constructor(error: Error | string) {
		super(typeof error === 'string' ? error : error.message);
		typeof error === 'object' && error.stack ? (this.stack = error.stack) : null;
	}
}

export class VersionError extends Error {
	constructor(requested: string) {
		super(
			`IPC action message version "${requested}" is different than expected "${version}".\n` +
				'Be sure than the "@beyond-js/ipc" package versions used across the different processes to be the same or compatible'
		);
	}
}

/**
 * File: main/index.ts
 */
import Child from './child';
import Main from './main';

module.exports = process.send ? new Child() : new Main();

/**
 * File: main/interfaces/index.ts
 */
export type ActionHandlerType = (...params: any[]) => any;

export type EventListenerType = (data: any) => void;

export const version = '1.0.0';

/**
 * Action call request
 */
export interface IActionRequest {
	version: typeof version;
	type: 'ipc.action.request';
	ipc: { instance: string };
	id: number;
	target: string;
	action: string;
	params: any[];
}

/**
 * Action response
 */
export interface IActionResponse {
	version: typeof version;
	type: 'ipc.action.response';
	ipc: { instance: string };
	request: { id: number };
	response?: any;
	error?: Error | string;
}

/**
 * Child event emit
 */
export interface IEvent {
	version: typeof version;
	type: 'ipc.event';
	event: string;
	data: any;
}

/**
 * Used for child to child communication, to inform the main process about the event subscription.
 * The main process uses the concept of bridges to route the other child events
 */
export interface IC2CSubscribe {
	version: typeof version;
	type: 'ipc.c2c.event.subscribe';
	ipc: { instance: string };
	processTag: string; // The process tag as it was registered in the IPC
	event: string;
}

export interface IC2CUnsubscribe {
	version: typeof version;
	type: 'ipc.c2c.event.unsubscribe';
	ipc: { instance: string };
	processTag: string; // The process tag as it was registered in the IPC
	event: string;
}

/**
 * Used for events in a child to child communication to route the event to their subscribers
 */
export interface IC2CEventRoute {
	version: typeof version;
	type: 'ipc.c2c.event.route';
	processTag: string; // The process tag as it was registered in the IPC
	event: string;
	data: any;
}

/**
 * File: main/main/actions/index.ts
 */
import type Dispatcher from '../../dispatcher';
import type { ActionHandlerType } from '../../interfaces';
import Routers from './routers';

export default class {
	#routers: Routers;

	constructor(dispatchers: Map<string, Dispatcher>) {
		this.#routers = new Routers(this, dispatchers);
	}

	#handlers: Map<string, ActionHandlerType> = new Map();

	handle = (action: string, handler: ActionHandlerType) => this.#handlers.set(action, handler);
	off = (action: string) => this.#handlers.delete(action);
	has = (action: string) => this.#handlers.has(action);

	/**
	 * Register a forked process to hear for actions requests
	 *
	 * @param name {string} The name assigned to the forked process
	 * @param fork {object} The forked process
	 */
	registerFork(name: string, fork: NodeJS.Process) {
		this.#routers.register(name, fork);
	}

	async exec(action: string, ...params: any[]) {
		if (!action) throw new Error(`Action parameter must be set`);

		// If this action is not handled, just return, no need to send a response as it is
		// possible that another IPC module is handling this action
		// (this can happen when there are multiple dependencies utilizing different versions of the IPC package)
		if (!this.#handlers.has(action)) return;

		// Execute the action
		const handler = this.#handlers.get(action);
		return await handler(...params);
	}

	destroy() {
		this.#routers.destroy();
	}
}

/**
 * File: main/main/actions/routers/child.ts
 */
import type Dispatcher from '../../../dispatcher';
import type { IActionRequest, IActionResponse } from '../../../interfaces';
import type Routers from '../';
import { version } from '../../../interfaces';
import { VersionError } from '../../../error';

export default class {
	#fork: NodeJS.Process;
	#routers: Routers;
	#dispatchers: Map<string, Dispatcher>;

	/**
	 * The #route method allows to execute actions received from a child process and that
	 * are executed in another child process.
	 * The main ipc manager provides the route function, as it has the dispatchers to execute actions
	 * on the forked processes, and the route is the function.
	 * that knows to which child process is the request being redirected.
	 *
	 * @param message
	 * @returns
	 */
	#route = async (message: IActionRequest): Promise<{ error?: string; value?: any }> => {
		const { target } = message;
		if (!this.#dispatchers.has(target)) {
			return { error: `Target "${message.target}" not found` };
		}

		const dispatcher = this.#dispatchers.get(target);
		const value = await dispatcher.exec(undefined, message.action, ...message.params);
		return { value };
	};

	constructor(routers: Routers, fork: NodeJS.Process, dispatchers: Map<string, Dispatcher>) {
		this.#routers = routers;
		this.#fork = fork;
		this.#dispatchers = dispatchers;
		fork.on('message', this.#onrequest);
	}

	#exec = async (message: IActionRequest) => {
		const send = ({ error, value }: { error?: string; value?: any }) => {
			const response: IActionResponse = {
				version,
				type: 'ipc.action.response',
				ipc: { instance: message.ipc.instance },
				request: { id: message.id },
				error,
				response: value
			};

			this.#fork.send(response);
		};

		if (!message.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		if (message.target === 'main') {
			if (!this.#routers.has(message.action)) {
				send({ error: `Action "${message.action}" not found` });
				return;
			}

			this.#routers
				.exec(message.action, ...message.params)
				.then((value: any) => {
					send({ value });
				})
				.catch((exc: Error) => {
					console.error(exc);
					send({ error: `Error execution IPC action: ${exc.message}` });
					return;
				});
		} else {
			send(await this.#route(message));
		}
	};

	#onrequest = (request: IActionRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.action.request') return;

		// Check the version of the communication protocol
		if (request.version !== version) {
			const error = new VersionError(request.version);
			console.error(error);
			return;
		}

		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}

		this.#exec(request).catch(exc => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		this.#fork.removeListener('message', this.#onrequest);
	}
}

/**
 * File: main/main/actions/routers/index.ts
 */
import type Dispatcher from '../../../dispatcher';
import type Actions from '../';
import ChildRouter from './child';

export default class {
	#actions: Actions;
	#dispatchers: Map<string, Dispatcher>;

	constructor(actions: Actions, dispatchers: Map<string, Dispatcher>) {
		this.#actions = actions;
		this.#dispatchers = dispatchers;
	}

	#routers: Map<string, ChildRouter> = new Map();

	register(name: string, fork: NodeJS.Process) {
		this.#routers.set(name, new ChildRouter(this.#actions, fork, this.#dispatchers));
	}

	destroy() {
		this.#routers.forEach(listener => listener.destroy());
	}
}

/**
 * File: main/main/events/index.ts
 */
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

/**
 * File: main/main/events/routers/child.ts
 */
import type Bridges from '.';
import type { IEvent, IC2CSubscribe, IC2CUnsubscribe, IC2CEventRoute } from '../../../interfaces';
import { version } from '../../../interfaces';
import { VersionError } from '../../../error';

export default class {
	#routes: Bridges;
	#tag: string;
	#fork: NodeJS.Process;

	#listeners = new Set();

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

			const key = `${message.processTag}|${message.ipc.instance}|${message.event}`;
			if (this.#listeners.has(key)) {
				console.warn(`Event "${key}" already subscribed`);
				return;
			}

			this.#listeners.add(key);
		} else if (message.type === 'ipc.c2c.event.unsubscribe') {
			if (!message.ipc?.instance || !message.processTag || !message.event) {
				console.error('Invalid message of event subscription remove', message);
				return;
			}

			const key = `${message.processTag}|${message.ipc.instance}|${message.event}`;
			if (!this.#listeners.has(key)) {
				console.warn(`Event "${key}" was not previously subscribed`);
				return;
			}

			this.#listeners.add(key);
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

/**
 * File: main/main/events/routers/index.ts
 */
import ChildRouter from './child';

export default class {
	#children: Map<string, ChildRouter> = new Map();

	// Private method used by the children processes to allow child-child notifications
	route(sourceProcessTag: string, event: string, data: any) {
		this.#children.forEach(bridge => bridge.route(sourceProcessTag, event, data));
	}

	register(tag: string, fork: NodeJS.Process) {
		this.#children.set(tag, new ChildRouter(this, tag, fork));
	}

	destroy() {
		this.#children.forEach(bridge => bridge.destroy());
	}
}

/**
 * File: main/main/index.ts
 */
import { v4 as uuid } from 'uuid';
import Actions from './actions';
import Events from './events';
import Dispatcher from '../dispatcher';

type ListenerType = (...[]) => any;

export default class {
	#dispatchers = new Map();

	/**
	 * The instance of the IPC module exists because a project may have multiple versions
	 * of the IPC package installed, stemming from different project dependencies
	 * requiring different versions of the package.
	 */
	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#actions = new Actions(this.#dispatchers);

	handle(action: string, listener: ListenerType) {
		this.#actions.handle(action, listener);
	}

	removeHandler(action: string) {
		this.#actions.off(action);
	}

	#events = new Events();
	get events() {
		return this.#events;
	}

	notify(event: string, message: any) {
		this.#events.emit(event, message);
	}

	register(name: string, fork: NodeJS.Process) {
		if (!name || !fork) {
			throw new Error('Invalid parameters');
		}

		if (this.#dispatchers.has(name)) {
			throw new Error(`Process "${name}" already registered`);
		}

		this.#dispatchers.set(name, new Dispatcher(this, fork));
		this.#actions.registerFork(name, fork);
		this.#events.registerFork(name, fork);
	}

	unregister(name: string) {
		// Check if forked process was previously registered
		if (!this.#dispatchers.has(name)) throw new Error(`Process ${name} not found`);

		// Unregister the forked process
		const dispatcher = this.#dispatchers.get(name);
		dispatcher.destroy();
		this.#dispatchers.delete(name);
	}

	/**
	 * Execute an IPC action
	 */
	async exec(target: string | undefined, action: string, ...params: any[]): Promise<any> {
		if (target === 'main') {
			// It is possible to execute an action from the main process directly
			// to an action of the main process
			return await this.#actions.exec(action, ...params);
		}

		if (!this.#dispatchers.has(target)) throw new Error(`Target process "${target}" not found`);

		// Execute the action in one of the registered processes
		const dispatcher = this.#dispatchers.get(target);
		return await dispatcher.exec(undefined, action, ...params);
	}

	destroy() {
		this.#dispatchers.forEach(dispatcher => dispatcher.destroy());
	}
}

/**
 * File: node_modules/@beyond-js/ipc/main.d.ts
 */
/************
Processor: ts
************/

// child\actions.ts
declare namespace ns_0 {
  import ActionHandlerType = ns_6.ActionHandlerType;
  export class _default {
    #private;
    handle(action: string, listener: ActionHandlerType): void;
    removeHandler(action: string): boolean;
    constructor();
    destroy(): void;
  }
}


// child\events.ts
declare namespace ns_1 {
  import EventListenerType = ns_6.EventListenerType;
  export class _default {
    #private;
    constructor();
    emit(event: string, data: any): void;
    on(processTag: string, event: string, listener: EventListenerType): void;
    off(processTag: string, event: string, listener: EventListenerType): void;
    destroy(): void;
  }
}


// child\index.ts
declare namespace ns_2 {
  import Actions = ns_0._default;
  import Events = ns_1._default;
  export class _default extends Actions {
    #private;
    get instance(): string;
    get events(): Events;
    constructor();
    notify(event: string, message: any): void;
    /**
     * Execute an IPC action
     *
     * @param target The name of the target process
     * @param action The nam	e of the action being requested
     * @param params The parameters of the action
     * @returns {*}
     */
    exec(target: string | undefined, action: string, ...params: any[]): Promise<any>;
    destroy(): void;
  }
}


// dispatcher\index.ts
declare namespace ns_3 {
  /// <reference types="node" />
  export class _default {
    #private;
    constructor(container: {
      instance: string;
    }, fork: NodeJS.Process);
    /**
     * Execute an IPC action
     */
    exec(target: string | undefined, action: string, ...params: any[]): Promise<any>;
    destroy(): void;
  }
}


// error.ts
declare namespace ns_4 {
  export class _default extends Error {
    constructor(error: Error | string);
  }
  export class VersionError extends Error {
    constructor(requested: string);
  }
}


// index.ts
declare namespace ns_5 {
  export {};
}


// interfaces\index.ts
declare namespace ns_6 {
  export type ActionHandlerType = (...params: any[]) => any;
  export type EventListenerType = (data: any) => void;
  export const version = "1.0.0";
  /**
   * Action call request
   */
  export interface IActionRequest {
    version: typeof version;
    type: 'ipc.action.request';
    ipc: {
      instance: string;
    };
    id: number;
    target: string;
    action: string;
    params: any[];
  }
  /**
   * Action response
   */
  export interface IActionResponse {
    version: typeof version;
    type: 'ipc.action.response';
    ipc: {
      instance: string;
    };
    request: {
      id: number;
    };
    response?: any;
    error?: Error | string;
  }
  /**
   * Child event emit
   */
  export interface IEvent {
    version: typeof version;
    type: 'ipc.event';
    event: string;
    data: any;
  }
  /**
   * Used for child to child communication, to inform the main process about the event subscription.
   * The main process uses the concept of bridges to route the other child events
   */
  export interface IC2CSubscribe {
    version: typeof version;
    type: 'ipc.c2c.event.subscribe';
    processTag: string;
    event: string;
  }
  export interface IC2CUnsubscribe {
    version: typeof version;
    type: 'ipc.c2c.event.unsubscribe';
    processTag: string;
    event: string;
  }
  /**
   * Used for events in a child to child communication to route the event to their subscribers
   */
  export interface IC2CEventRoute {
    version: typeof version;
    type: 'ipc.c2c.event.route';
    processTag: string;
    event: string;
    data: any;
  }
}


// main\actions\index.ts
declare namespace ns_7 {
  /// <reference types="node" />
  import Dispatcher = ns_3._default;
  import ActionHandlerType = ns_6.ActionHandlerType;
  export class _default {
    #private;
    constructor(dispatchers: Map<string, Dispatcher>);
    handle: (action: string, handler: ActionHandlerType) => Map<string, ActionHandlerType>;
    off: (action: string) => boolean;
    has: (action: string) => boolean;
    /**
     * Register a forked process to hear for actions requests
     *
     * @param name {string} The name assigned to the forked process
     * @param fork {object} The forked process
     */
    registerFork(name: string, fork: NodeJS.Process): void;
    exec(action: string, ...params: any[]): Promise<any>;
    destroy(): void;
  }
}


// main\actions\routers\child.ts
declare namespace ns_8 {
  /// <reference types="node" />
  import Dispatcher = ns_3._default;
  import Server = ns_7._default;
  export class _default {
    #private;
    constructor(actions: Server, fork: NodeJS.Process, dispatchers: Map<string, Dispatcher>);
    destroy(): void;
  }
}


// main\actions\routers\index.ts
declare namespace ns_9 {
  /// <reference types="node" />
  import Dispatcher = ns_3._default;
  import Actions = ns_7._default;
  export class _default {
    #private;
    constructor(actions: Actions, dispatchers: Map<string, Dispatcher>);
    register(name: string, fork: NodeJS.Process): void;
    destroy(): void;
  }
}


// main\events\index.ts
declare namespace ns_10 {
  /// <reference types="node" />
  /// <reference types="node" />
  /// <reference types="node" />
  /// <reference types="node" />
  /// <reference types="node" />
  /// <reference types="node" />
  /// <reference types="node" />
  import EventListenerType = ns_6.EventListenerType;
  export class _default {
    #private;
    constructor();
    /**
     * Register a listener for an event received from a given child process
     *
     * @param child The child process name given when it was registered in the IPC
     * @param event The event name
     * @param listener The callback to be executed when the event occurs
     */
    on(child: string, event: string, listener: EventListenerType): void;
    /**
     * Remove a registered event listener
     *
     * @param child The child process name given when it was registered in the IPC
     * @param event The event name
     * @param listener The previously registered listener function
     */
    off(child: string, event: string, listener: EventListenerType): void;
    emit(event: string, data: any): void;
    /**
     * Register a fork process to hear for actions requests
     */
    registerFork: (name: string, fork: NodeJS.Process) => void;
  }
}


// main\events\routers\child.ts
declare namespace ns_11 {
  /// <reference types="node" />
  import Bridges = ns_12._default;
  export class _default {
    #private;
    constructor(routes: Bridges, tag: string, fork: NodeJS.Process);
    /**
     * Route the event if the forked process is registered to it.
     * The execution of this method is expected to be made only by the index.ts file (the routes collection).
     *
     * @param processTag The tag of the process that is sending the event
     * @param event The event name
     * @param data The data to be sent
     */
    route(processTag: string, event: string, data: any): void;
    destroy(): void;
  }
}


// main\events\routers\index.ts
declare namespace ns_12 {
  /// <reference types="node" />
  export class _default {
    #private;
    route(sourceProcessTag: string, event: string, data: any): void;
    register(tag: string, fork: NodeJS.Process): void;
    destroy(): void;
  }
}


// main\index.ts
declare namespace ns_13 {
  /// <reference types="node" />
  import Events = ns_10._default;
  type ListenerType = (...[]: Iterable<any>) => any;
  export class _default {
    #private;
    get instance(): string;
    handle(action: string, listener: ListenerType): void;
    removeHandler(action: string): void;
    get events(): Events;
    notify(event: string, message: any): void;
    register(name: string, fork: NodeJS.Process): void;
    unregister(name: string): void;
    /**
     * Execute an IPC action
     */
    exec(target: string | undefined, action: string, ...params: any[]): Promise<any>;
    destroy(): void;
  }
  export {};
}



export declare const hmr: {on: (event: string, listener: any) => void, off: (event: string, listener: any) => void };
