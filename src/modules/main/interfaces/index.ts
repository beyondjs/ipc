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
