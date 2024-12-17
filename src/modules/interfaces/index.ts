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
