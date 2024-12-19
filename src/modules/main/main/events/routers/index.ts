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
