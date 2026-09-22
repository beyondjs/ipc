/**
 * Actions and events between a parent and its registered children, with the real processes: every route,
 * unknown targets and handlers, error serialization, subscriptions, disconnection and teardown.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ipc } from '@beyond-js/ipc/main';
import { ipc as wrapper } from '@beyond-js/ipc/wrapper';
import { SerializableError } from '@beyond-js/ipc/errors';

const here = dirname(fileURLToPath(import.meta.url));
const children = new Map();

/** Starts a child under the loader of this process and waits for it to report readiness */
function start(name) {
	return new Promise((resolve, reject) => {
		const child = fork(join(here, 'child.mjs'), [name], { execArgv: process.execArgv, env: process.env, cwd: process.cwd() });
		const onmessage = message => {
			if (message?.type !== 'test:ready') return;
			child.removeListener('message', onmessage);
			children.set(name, child);
			resolve(child);
		};
		child.on('message', onmessage);
		child.once('exit', code => reject(new Error(`child "${name}" exited with ${code} before it was ready`)));
	});
}

const exited = child => new Promise(resolve => (child.exitCode !== null ? resolve(child.exitCode) : child.once('exit', resolve)));

// A channel between two processes delivers in order, and a child sends what an action causes (a
// subscription, an event) before it answers the action. So when an `exec` resolves, everything that action
// caused has reached this process, and whatever this process sends next arrives after it: the tests below
// wait for answers, never for time.

before(async () => {
	for (const name of ['child-a', 'child-b']) ipc.register(name, await start(name));
	ipc.handle('ping', message => `pong from main: ${message}`);
});

after(async () => {
	for (const [name, child] of children) {
		try {
			ipc.unregister(name);
		} catch {}
		child.kill();
		await exited(child);
	}
});

test('every route: main to main, main to child, child to main and child to child', async () => {
	assert.equal(await ipc.exec('main', 'ping', 'x'), 'pong from main: x');
	assert.equal(await ipc.exec('child-a', 'ping', 'x'), 'pong from child-a: x');
	assert.equal(await ipc.exec('child-a', 'call', 'main', 'ping', 'y'), 'pong from main: y');
	assert.equal(await ipc.exec('child-a', 'call', 'child-b', 'ping', 'z'), 'pong from child-b: z');
	assert.equal(await ipc.exec('child-b', 'call', 'child-a', 'call', 'main', 'ping', 'w'), 'pong from main: w');
});

test('the wrapper selects the main handler in this process and shares its handlers', async () => {
	assert.equal(await wrapper.exec('main', 'ping', 'wrapped'), 'pong from main: wrapped');
	assert.equal(await wrapper.exec('child-a', 'ping', 'wrapped'), 'pong from child-a: wrapped');
});

test('unknown handlers and targets are errors on every route, and a handler installed later answers', async () => {
	await assert.rejects(ipc.exec('main', 'missing'), /No handler registered for action "missing"/);
	await assert.rejects(ipc.exec('child-a', 'missing'), /No handler registered for action "missing"/);
	await assert.rejects(ipc.exec('nobody', 'ping'), /"nobody" not found/);
	await assert.rejects(ipc.exec('child-a', 'call', 'nobody', 'ping'), /"nobody" not found/);
	await assert.rejects(ipc.exec('child-a', 'call', 'child-b', 'missing'), /No handler registered/);

	await assert.rejects(ipc.exec('child-a', 'later'), /No handler registered/);
	await ipc.exec('child-a', 'install', 'later', 42);
	assert.equal(await ipc.exec('child-a', 'later'), 42, 'a handler installed after a request failed answers the next one');

	ipc.detach('ping');
	await assert.rejects(ipc.exec('main', 'ping'), /No handler registered/);
	ipc.handle('ping', message => `pong from main: ${message}`);
});

test('errors travel with their cause chain, and are printable', async () => {
	const error = await ipc.exec('child-a', 'error').then(() => assert.fail('should reject'), error => error);
	assert.ok(error instanceof Error);
	assert.equal(error.message, 'top');
	assert.equal(error.cause?.message, 'middle');
	assert.equal(error.cause?.cause?.message, 'base');
	assert.match(error.stack, /child\.mjs/, 'the stack of the child is preserved');
	assert.match(SerializableError.print(error), /top[\s\S]*middle[\s\S]*base/);
});

test('a falsy or non-Error throw still rejects, and a cyclic cause does not overflow', async () => {
	for (const value of ['null', 'false', 'zero']) {
		await assert.rejects(ipc.exec('child-a', 'throw', value), error => {
			assert.ok(error instanceof Error, `${value}: rejects with an Error`);
			return true;
		});
	}
	const text = await ipc.exec('child-a', 'throw', 'a plain string').then(() => assert.fail(), error => error);
	assert.equal(text.message, 'a plain string');

	const cyclic = await ipc.exec('child-a', 'cyclic').then(() => assert.fail(), error => error);
	assert.equal(cyclic.message, 'a');
	assert.equal(cyclic.cause?.message, 'b');
	assert.equal(cyclic.cause?.cause?.message, '[circular cause]');
});

test('serialization of values and cycles in this process', () => {
	assert.deepEqual(SerializableError.serialize('text'), { message: 'text', stack: '' });
	assert.deepEqual(SerializableError.serialize(null), { message: 'null', stack: '' });
	assert.deepEqual(SerializableError.serialize(undefined), { message: 'undefined', stack: '' });
	assert.equal(SerializableError.serialize({ toJSON() { throw new Error('hostile'); } }).message, '[object Object]');

	const a = new Error('a');
	a.cause = a;
	const wire = SerializableError.serialize(a);
	assert.equal(wire.cause.message, '[circular cause]');
	const back = SerializableError.deserialize(wire);
	assert.equal(back.message, 'a');
	assert.equal(back.cause.message, '[circular cause]');
});

test('events: the first subscription registers, the last unsubscription unregisters, and origins are distinct', async () => {
	await ipc.exec('child-b', 'subscribe', 'main', 'tick');
	await ipc.exec('child-b', 'subscribe', 'child-a', 'tick');

	ipc.emit('tick', 'from main');
	await ipc.exec('child-a', 'emit', 'tick', 'from child-a');
	await ipc.exec('child-a', 'emit', 'other', 'not subscribed');
	assert.deepEqual(await ipc.exec('child-b', 'received'), ['from main', 'from child-a']);
	assert.deepEqual(ipc.events.subscriptions('child-b').sort(), ['child-a|tick', 'main|tick']);

	await ipc.exec('child-b', 'unsubscribe', 'main', 'tick');
	assert.deepEqual(ipc.events.subscriptions('child-b'), ['child-a|tick'], 'the parent forgot the released subscription');
	ipc.emit('tick', 'after unsubscribe');
	await ipc.exec('child-a', 'emit', 'tick', 'still subscribed');
	assert.deepEqual(await ipc.exec('child-b', 'received'), ['still subscribed']);
	await ipc.exec('child-b', 'unsubscribe', 'child-a', 'tick');
});

test('the main process subscribes to a child origin and to itself, and off keeps identity', async () => {
	const heard = [];
	const listener = data => heard.push(data);
	ipc.on('child-a', 'ping-event', listener);
	ipc.on('main', 'self', listener);
	await ipc.exec('child-a', 'emit', 'ping-event', 1);
	ipc.emit('self', 2);
	assert.deepEqual(heard, [1, 2]);
	ipc.off('child-a', 'ping-event', listener);
	ipc.off('main', 'self', listener);
	await ipc.exec('child-a', 'emit', 'ping-event', 3);
	assert.deepEqual(heard, [1, 2]);
	assert.throws(() => ipc.on('a|b', 'event', listener), /cannot contain/);
});

test('a bogus response is logged and ignored; a duplicate name and the reserved name are refused', async () => {
	children.get('child-a').send({ type: 'ipc.response', request: 'no-such-request', data: 1 });
	assert.equal(await ipc.exec('child-a', 'ping', 'still fine'), 'pong from child-a: still fine');
	assert.throws(() => ipc.register('child-a', children.get('child-a')), /already registered/);
	assert.throws(() => ipc.register('main', children.get('child-a')), /Cannot register the main process/);
	assert.throws(() => ipc.unregister('nobody'), /not found/);
});

test('a child that exits rejects the requests pending on it, and a later request fails to send', async () => {
	const child = await start('child-exit');
	ipc.register('child-exit', child);
	const pending = ipc.exec('child-exit', 'hang').then(() => assert.fail('should reject'), error => error);
	await ipc.exec('child-exit', 'exit', 0);
	await exited(child);
	assert.match((await pending).message, /disconnected/);
	await assert.rejects(ipc.exec('child-exit', 'ping'), /disconnected|could not be sent|closed/);
	ipc.unregister('child-exit');
	children.delete('child-exit');
	await assert.rejects(ipc.exec('child-exit', 'ping'), /not found/);
});

test('unregistering a child rejects what it still owes, and destroy releases everything', async () => {
	const child = await start('child-late');
	ipc.register('child-late', child);
	const owed = ipc.exec('child-late', 'hang').then(() => assert.fail('should reject'), error => error);
	ipc.unregister('child-late');
	assert.match((await owed).message, /destroyed/);
	child.kill();
	await exited(child);

	const other = await start('child-destroy');
	ipc.register('child-destroy', other);
	const promise = ipc.exec('child-destroy', 'hang').then(() => assert.fail('should reject'), error => error);
	ipc.destroy();
	assert.match((await promise).message, /destroyed/);
	await assert.rejects(ipc.exec('child-destroy', 'ping'), /not found/);
	other.kill();
	await exited(other);
});
