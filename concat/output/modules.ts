/**
 * File: child\events.ts
 */
import type {
	IAddEventListener,
	IRemoveEventListener,
	IEventEmit,
	IEventDispatch,
	EventListenerType
} from '../interfaces';

export default class {
	#listeners: Map<string, Set<EventListenerType>> = new Map();

	constructor() {
		process.on('message', this.#onevent);
	}

	emit(event: string, message: any) {
		process.send(<IEventEmit>{ type: 'ipc.event.emit', event, message });
	}

	on(source: string, event: string, listener: EventListenerType) {
		if (typeof source !== 'string' || typeof event !== 'string' || typeof listener !== 'function') {
			throw new Error('Invalid parameters');
		}

		const key = `${source}|${event}`;
		!this.#listeners.has(key) && process.send(<IAddEventListener>{ type: 'ipc.add.event.listener', source, event });

		let listeners: Set<EventListenerType>;
		if (this.#listeners.has(key)) {
			listeners = this.#listeners.get(key);
		} else {
			listeners = new Set();
			this.#listeners.set(key, listeners);
		}
		listeners.add(listener);
	}

	off(source: string, event: string, listener: EventListenerType) {
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

		!listeners.size &&
			this.#listeners.delete(key) &&
			process.send(<IRemoveEventListener>{
				type: 'ipc.remove.event.listener',
				source: source,
				event: event
			});
	}

	#exec = (message: IEventDispatch) => {
		const key = `${message.source}|${message.event}`;
		if (!this.#listeners.has(key)) {
			console.warn(`Received an event with no listeners registered "${key}"`);
			return;
		}

		const listeners = this.#listeners.get(key);
		listeners.forEach(listener => {
			// Execute the listener
			try {
				listener(message.message);
			} catch (exc) {
				console.error(`Error executing listener of event "${key}"`, exc.stack);
			}
		});
	};

	#onevent = (message: IEventDispatch) => {
		// Check if message is an IPC event, otherwise just return
		if (typeof message !== 'object' || message.type !== 'ipc.event.dispatch') return;
		if (!message.source || !message.event) {
			console.error('Invalid event message received', message);
			return;
		}

		this.#exec(message);
	};

	destroy() {
		process.removeListener('message', this.#onevent);
	}
}

/**
 * File: child\index.ts
 */
import type Dispatcher from '../dispatcher';
import IPCServer from './server';
import { v4 as uuid } from 'uuid';

export default class extends IPCServer {
	#dispatcher: Dispatcher;

	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#events = new (require('./events'))();
	get events() {
		return this.#events;
	}

	constructor() {
		super();

		this.#dispatcher = new (require('../dispatcher'))(undefined, this);
	}

	notify(...params: any[]) {
		this.#events.emit(...params);
	}

	/**
	 * Execute an IPC action
	 *
	 * @param target The name of the target process
	 * @param action The name of the action being requested
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
 * File: child\server.ts
 */
import type { IRequest, IResponse, ActionHandlerType } from '../interfaces';

export default class {
	#handlers: Map<string, ActionHandlerType> = new Map();

	handle = (action: string, listener: ActionHandlerType) => this.#handlers.set(action, listener);
	removeHandler = (action: string) => this.#handlers.delete(action);

	constructor() {
		process.on('message', this.#onrequest);
	}

	#exec = async (message: IRequest) => {
		const send = (response: object) => {
			Object.assign(response, <IResponse>{ type: 'ipc.response', request: { id: message.id } });
			process.send(response);
		};

		if (!message.action) {
			send({ error: 'Property action is undefined' });
			return;
		}

		if (!this.#handlers.has(message.action)) {
			send({ error: `Handler of action "${message.action}" not found` });
			return;
		}

		const handler = this.#handlers.get(message.action);

		let response;
		try {
			response = await handler(...message.params);
		} catch (exc) {
			send({ error: { message: exc.message, stack: exc.stack } });
			return;
		}

		send({ response: response });
	};

	#onrequest = (request: IRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.request') return;
		if (!request.id) {
			console.error('An undefined request id received on ipc communication', request);
			return;
		}
		this.#exec(request).catch(exc => console.error(exc instanceof Error ? exc.stack : exc));
	};

	destroy() {
		process.removeListener('message', this.#onrequest);
	}
}

/**
 * File: dispatcher\index.ts
 */
import type { IRequest, IResponse } from '../interfaces';
import { PendingPromise } from '@beyond-js/pending-promise/main';

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

	#IPCError = require('../error');

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

		const rq: IRequest = {
			type: 'ipc.request',
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
	#onresponse = (message: IResponse) => {
		// Check if message is an IPC response, otherwise just return
		if (typeof message !== 'object' || message.type !== 'ipc.response') return;

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
 * File: error.ts
 */
module.exports = class extends Error {
	constructor(error: Error) {
		super(typeof error === 'string' ? error : error.message);
		typeof error === 'object' && error.stack ? (this.stack = error.stack) : null;
	}
};

/**
 * File: index.ts
 */
import Child from './child';
import Main from './main';

module.exports = process.send ? new Child() : new Main();

/**
 * File: interfaces\index.ts
 */
export type ActionHandlerType = (...params: any[]) => any;

export type EventListenerType = (message: any) => void;

export interface IRequest {
	type: 'ipc.request';
	ipc: { instance: string };
	id: number;
	target: string;
	action: string;
	params: any[];
}

export interface IResponse {
	type: 'ipc.response';
	ipc: { instance: string };
	request: { id: number };
	response?: any;
	error?: Error | string;
}

export interface IAddEventListener {
	type: 'ipc.add.event.listener';
	source: string;
	event: string;
}

export interface IRemoveEventListener {
	type: 'ipc.remove.event.listener';
	source: string;
	event: string;
}

export interface IEventDispatch {
	type: 'ipc.event.dispatch';
	source: string;
	event: string;
	message: any;
}

export interface IEventEmit {
	type: 'ipc.event.emit';
	event: string;
	message: any;
}

/**
 * File: main\events\index.ts
 */
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

/**
 * File: main\events\sources\index.ts
 */
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

/**
 * File: main\events\sources\source.ts
 */
import type Sources from '.';
import type { IAddEventListener, IEventDispatch, IEventEmit, IRemoveEventListener } from '../../../interfaces';

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
			this.#fork.send(<IEventDispatch>{ type: 'ipc.event.dispatch', source: sourceName, event, message });
		} catch (exc) {
			console.warn(`Error emitting event ${key} to fork process with name "${this.#name}"`, exc.message);
		}
	}

	#onmessage = (message: IAddEventListener | IRemoveEventListener | IEventEmit) => {
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

/**
 * File: main\index.ts
 */
import { v4 as uuid } from 'uuid';

type ListenerType = (...[]) => any;

export default class {
	#dispatchers = new Map();

	#instance = uuid();
	get instance() {
		return this.#instance;
	}

	#server = new (require('./server'))(this.#dispatchers);
	handle = (action: string, listener: ListenerType) => this.#server.handle(action, listener);
	removeHandler = (action: string) => this.#server.off(action);

	#events = new (require('./events'))();
	get events() {
		return this.#events;
	}

	notify(...params: any[]) {
		this.#events.emit(...params);
	}

	register(name: string, fork: NodeJS.Process) {
		if (!name || !fork) {
			throw new Error('Invalid parameters');
		}

		if (this.#dispatchers.has(name)) {
			throw new Error(`Process "${name}" already registered`);
		}

		this.#dispatchers.set(name, new (require('../dispatcher'))(fork, this));
		this.#server.registerFork(name, fork);
		this.#events.registerFork(name, fork);
	}

	unregister(name: string) {
		if (!this.#dispatchers.has(name)) throw new Error(`Process ${name} not found`);
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
			return await this.#server.exec(action, ...params);
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
 * File: main\server\index.ts
 */
import type Dispatcher from '../../dispatcher';
import type { ActionHandlerType } from '../../interfaces';

export default class {
	// Listeners of the forked processes messages
	#listeners;

	constructor(dispatchers: Map<string, Dispatcher>) {
		this.#listeners = new (require('./listeners'))(this, dispatchers);
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
		this.#listeners.register(name, fork);
	}

	async exec(action: string, ...params: any[]) {
		if (!action) throw new Error(`Action parameter must be set`);
		if (!this.#handlers.has(action)) throw new Error(`Action "${action}" not set`);

		// Execute the action
		return await this.#handlers.get(action)(...params);
	}

	destroy() {
		this.#listeners.destroy();
	}
}

/**
 * File: main\server\listeners\index.ts
 */
import type Dispatcher from '../../../dispatcher';
import type Server from '../';
import Listener from './listener';

export default class {
	#server: Server;
	#dispatchers: Map<string, Dispatcher>;

	constructor(server: Server, dispatchers: Map<string, Dispatcher>) {
		this.#server = server;
		this.#dispatchers = dispatchers;
	}

	#listeners = new Map();

	register(name: string, fork: NodeJS.Process) {
		this.#listeners.set(name, new Listener(this.#server, fork, this.#dispatchers));
	}

	destroy() {
		this.#listeners.forEach(listener => listener.destroy());
	}
}

/**
 * File: main\server\listeners\listener.ts
 */
import type Dispatcher from '../../../dispatcher';
import type { IRequest, IResponse } from '../../../interfaces';
import type Server from '../';

export default class {
	#fork;
	#server;
	#dispatchers;

	// The bridge function that allows to execute actions received from a child process
	// and that are executed in another child process
	// The main ipc manager provides the bridge function, as it has the dispatchers
	// to execute actions on the forked processes, and the bridge is the function
	// that knows to which child process is the request being redirected
	#bridge = async (message: IRequest): Promise<{ error?: string; value?: any }> => {
		const { target } = message;
		if (!this.#dispatchers.has(target)) {
			return { error: `Target "${message.target}" not found` };
		}

		const dispatcher = this.#dispatchers.get(target);
		const value = await dispatcher.exec(undefined, message.action, ...message.params);
		return { value };
	};

	constructor(server: Server, fork: NodeJS.Process, dispatchers: Map<string, Dispatcher>) {
		this.#server = server;
		this.#fork = fork;
		this.#dispatchers = dispatchers;
		fork.on('message', this.#onrequest);
	}

	#exec = async (message: IRequest) => {
		const send = ({ error, value }: { error?: string; value?: any }) => {
			const response: IResponse = {
				type: 'ipc.response',
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
			if (!this.#server.has(message.action)) {
				send({ error: `Action "${message.action}" not found` });
				return;
			}

			let value: any;
			try {
				value = await this.#server.exec(message.action, ...message.params);
			} catch (exc) {
				console.error(exc);
				send({ error: `Error execution IPC action: ${exc.message}` });
				return;
			}
			send({ value });
		} else {
			send(await this.#bridge(message));
		}
	};

	#onrequest = (request: IRequest) => {
		// Check if message is effectively an IPC request
		if (typeof request !== 'object' || request.type !== 'ipc.request') return;
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

