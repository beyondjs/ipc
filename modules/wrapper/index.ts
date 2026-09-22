import { PendingPromise } from '@beyond-js/pending-promise/main';
import type { IProcessHandler, IMainProcessHandler, IListener, IHandler } from '@beyond-js/ipc/types';

declare const bimport: (module: string) => Promise<any>;

class ProcessHandlerWrapper implements IProcessHandler {
	#handler: PendingPromise<IProcessHandler | IMainProcessHandler>;

	constructor() {
		this.#handler = new PendingPromise<IProcessHandler | IMainProcessHandler>();

		// A failure to load the handler is delivered to every call, instead of leaving them pending forever
		this.#handler.catch(() => void 0);

		if (typeof bimport !== 'function') {
			this.#handler.reject(new Error('The IPC wrapper needs the global `bimport` of the Beyond runtime; import the main or child module directly'));
			return;
		}

		// A process with a channel to its parent is a child process; the main process has none
		const specifier = process.send ? '@beyond-js/ipc/child' : '@beyond-js/ipc/main';
		bimport(specifier).then(
			({ ipc }: { ipc: IProcessHandler | IMainProcessHandler }) => this.#handler.resolve(ipc),
			(error: Error) => this.#handler.reject(error)
		);
	}

	/** Runs a call once the handler is loaded, reporting a handler that could not be loaded */
	#then(call: (handler: IProcessHandler | IMainProcessHandler) => void) {
		this.#handler.then(call).catch(error => console.error(`IPC wrapper: ${error.message}`));
	}

	on(origin: string, event: string, listener: IListener): void {
		this.#then(handler => handler.on(origin, event, listener));
	}

	off(origin: string, event: string, listener: IListener): void {
		this.#then(handler => handler.off(origin, event, listener));
	}

	emit(event: string, data: any): void {
		this.#then(handler => handler.emit(event, data));
	}

	async exec(target: string, action: string, ...params: any[]): Promise<any> {
		const handler = await this.#handler;
		return await handler.exec(target, action, ...params);
	}

	handle(action: string, callback: IHandler): void {
		this.#then(handler => handler.handle(action, callback));
	}

	detach(action: string): void {
		this.#then(handler => handler.detach(action));
	}

	notify(event: string, data: any): void {
		this.#then(handler => handler.notify(event, data));
	}

	destroy(): void {
		this.#then(handler => handler.destroy());
	}

	register?(name: string, fork: any): void {
		this.#then(handler => {
			if (!('register' in handler)) throw new Error('This method is only available in the main process.');
			(handler as IMainProcessHandler).register(name, fork);
		});
	}

	unregister?(name: string): void {
		this.#then(handler => {
			if (!('unregister' in handler)) throw new Error('This method is only available in the main process.');
			(handler as IMainProcessHandler).unregister(name);
		});
	}
}

export /*bundle*/ const ipc = new ProcessHandlerWrapper();
