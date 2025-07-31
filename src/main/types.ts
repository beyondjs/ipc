/**
 * Handler function for executing an action.
 */
export /*bundle*/ type IHandler = (...args: any[]) => any;

/**
 * Listener function for receiving dispatched event data.
 */
export /*bundle*/ type IListener = (data: any) => void;

export type MessageType =
	| 'ipc.request'
	| 'ipc.response'
	| 'ipc.event.emit'
	| 'ipc.event.dispatch'
	| 'ipc.event.subscribe'
	| 'ipc.event.unsubscribe';

/**
 * Subscription or unsubscription to a specific event from a given origin.
 *
 * This message is sent from a child process to the main process to declare interest
 * in a particular event. It enables the main process (which acts as a router) to
 * maintain a subscription map and only forward relevant events to the appropriate
 * subscribers.
 *
 * Without this mechanism, the main process would need to broadcast every emitted event
 * to all child processes, resulting in unnecessary inter-process communication and wasted resources.
 *
 * By explicitly subscribing, each process ensures that it only receives the events
 * it actually listens to, and the router can optimize event routing accordingly.
 */
export /*bundle*/ type IEventSubscription = {
	/** Type of message: subscribe or unsubscribe */
	type: 'ipc.event.subscribe' | 'ipc.event.unsubscribe';

	/** Process identifier declaring the subscription */
	origin: string;

	/** Name of the event being subscribed to or unsubscribed from */
	event: string;
};

/**
 * Emitted event message sent from any process.
 * This message informs the system that an event has occurred and should be dispatched.
 */
export /*bundle*/ type IEventEmit = {
	/** Type identifier for emitted events */
	type: 'ipc.event.emit';

	/** Name of the emitted event */
	event: string;

	/** Payload data associated with the event */
	data: any;
};

/**
 * Event message that has been routed and dispatched to a subscriber.
 * Sent from the main process to subscribed child processes.
 */
export /*bundle*/ type IEventMessage = {
	type: 'ipc.event.dispatch';
	origin: string;
	event: string;
	data: any;
};

/**
 * Request to execute an action remotely.
 * Sent from a caller process to the target process (or routed via the main process).
 */
export /*bundle*/ type IRequestMessage = {
	/** Type identifier for action requests */
	type: 'ipc.request';

	/** Target process ID to execute the action */
	target: string;

	/** Unique request ID used to match the response */
	id: string;

	/** Name of the action to execute */
	action: string;

	/** Parameters to pass to the action handler */
	params: any[];
};

/**
 * Response to an action execution request.
 * Sent back to the process that initiated the request.
 */
export /*bundle*/ type IResponseMessage = {
	/** Type identifier for action responses */
	type: 'ipc.response';

	/** ID of the original request being responded to */
	request: string;

	ipc?: { instance: string };

	/** Returned result of the action execution */
	response?: any;

	/** Error information if the action failed */
	error?: { message: string; stack?: string };
};

export interface IProcessHandler {
	on: (origin: string, event: string, listener: IListener) => void;
	off: (origin: string, event: string, listener: IListener) => void;
	emit: (event: string, data: any) => void;
	exec: (target: string, action: string, ...params: any[]) => Promise<any>;
	destroy: () => void;
}
