export /*bundle*/ type IListener = (data: any) => void;

export /*bundle*/ type IHandler = (...args: any[]) => any;

export /*bundle*/ type IEventSubscription = {
	type: 'ipc.add.event.listener' | 'ipc.remove.event.listener';
	source: string;
	event: string;
};

export /*bundle*/ type IEvent = {
	source: string;
	event: string;
	listener: IListener;
};

export /*bundle*/ type IEventEmit = {
	type: 'ipc.event.emit';
	event: string;
	data: any;
};

export /*bundle*/ type IEventMessage = {
	type: 'ipc.event.dispatch';
	source: string;
	event: string;
	data: any;
};

export /*bundle*/ type IRequestMessage = {
	type: 'ipc.request';
	target: string;
	id: string;
	action: string;
	params: any[];
};

export /*bundle*/ type IResponseMessage = {
	request: { type: 'ipc.response'; id: string };
	ipc?: { instance: string };
	response?: any;
	error?: { message: string; stack?: string };
};

// export /*bundle*/ type IEventMessageData = IEventMessage | IEventSubscription | IEventEmit | IExecMessage;
