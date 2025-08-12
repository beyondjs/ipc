import { PendingPromise } from '@beyond-js/pending-promise/main';
import type { IProcessHandler, IMainProcessHandler, IListener, IHandler } from '@beyond-js/ipc/types';

declare const bimport: (module: string) => Promise<any>;

class ProcessHandlerWrapper implements IProcessHandler {
	#handler: PendingPromise<IProcessHandler | IMainProcessHandler>;

	constructor() {
		this.#handler = new PendingPromise<IProcessHandler | IMainProcessHandler>();

		if (process.send) {
			// If process.send is available, we are in a child process context
			bimport('@beyond-js/ipc/child').then(({ ipc }: { ipc: IProcessHandler }) => {
				this.#handler.resolve(ipc);
			});
		} else {
			// If process.send is not available, we are in a main process context
			bimport('@beyond-js/ipc/main').then(({ ipc }: { ipc: IMainProcessHandler }) => {
				this.#handler.resolve(ipc);
			});
		}
	}

	on(origin: string, event: string, listener: IListener): void {
		this.#handler.then(handler => handler.on(origin, event, listener));
	}

	off(origin: string, event: string, listener: IListener): void {
		this.#handler.then(handler => handler.off(origin, event, listener));
	}

	emit(event: string, data: any): void {
		this.#handler.then(handler => handler.emit(event, data));
	}

	async exec(target: string, action: string, ...params: any[]): Promise<any> {
		const handler = await this.#handler;
		return await handler.exec(target, action, ...params);
	}

	handle(action: string, callback: IHandler): void {
		this.#handler.then(handler => handler.handle(action, callback));
	}

	detach(action: string): void {
		this.#handler.then(handler => handler.detach(action));
	}

	notify(event: string, data: any): void {
		this.#handler.then(handler => handler.notify(event, data));
	}

	destroy(): void {
		this.#handler.then(handler => handler.destroy());
	}

	register?(name: string, fork: any): void {
		this.#handler.then(handler => {
			if (!('register' in handler)) throw new Error('This method is only available in the main process.');
			(handler as IMainProcessHandler).register(name, fork);
		});
	}

	unregister?(name: string): void {
		this.#handler.then(handler => {
			if (!('unregister' in handler)) throw new Error('This method is only available in the main process.');
			(handler as IMainProcessHandler).unregister(name);
		});
	}
}

export /*bundle*/ const ipc = new ProcessHandlerWrapper();
