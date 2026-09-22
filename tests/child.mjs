/**
 * A child process of the IPC tests. It installs the actions the tests call and reports its readiness to the
 * parent, which registers it under the name given as its first argument.
 */
import { ipc } from '@beyond-js/ipc/child';

const name = process.argv[2];
let received = [];
const listener = data => received.push(data);

ipc.handle('ping', message => `pong from ${name}: ${message}`);
ipc.handle('error', () => {
	const base = new Error('base');
	throw new Error('top', { cause: new Error('middle', { cause: base }) });
});
ipc.handle('throw', value => {
	throw value === 'null' ? null : value === 'false' ? false : value === 'zero' ? 0 : value;
});
ipc.handle('cyclic', () => {
	const a = new Error('a');
	const b = new Error('b', { cause: a });
	a.cause = b;
	throw a;
});
ipc.handle('call', (target, action, ...params) => ipc.exec(target, action, ...params));
// An action that never answers, so that a request stays owed until the test ends it
ipc.handle('hang', () => new Promise(() => void 0));
ipc.handle('exit', code => {
	// The answer is sent after this handler returns, and nothing reports when the channel wrote it: the
	// child leaves it a moment. This is the fixture's exit, not a wait of the test.
	setTimeout(() => process.exit(code), 20);
	return 'exiting';
});
ipc.handle('subscribe', (origin, event) => ipc.on(origin, event, listener));
ipc.handle('unsubscribe', (origin, event) => ipc.off(origin, event, listener));
ipc.handle('received', () => {
	const data = received;
	received = [];
	return data;
});
ipc.handle('emit', (event, data) => ipc.emit(event, data));
ipc.handle('install', (action, value) => ipc.handle(action, () => value));

process.send({ type: 'test:ready', name });
