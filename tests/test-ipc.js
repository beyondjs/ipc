require('colors');
const { fork } = require('child_process');
const BEE = require('@beyond-js/bee');

BEE('http://localhost:1110', { inspect: 4000 });

(async () => {
	const { ipc } = await bimport('@beyond-js/ipc/wrapper');

	const cwd = __dirname;
	const children = {
		a: fork('./child-a.js', { cwd }),
		b: fork('./child-b.js', { cwd })
	};
	ipc.register('child-a', children.a);
	ipc.register('child-b', children.b);

	// Register the 'ping' handler for the main process
	ipc.handle('ping', message => `pong from master: ${message}`);

	// Master-child test
	const response = await ipc.exec('child-a', 'ping', 'Hello world!');
	console.log(`Master-child (child-a) exec test:\n`.green + `${response}`);

	// Event subscription test
	ipc.on('child-a', 'test-event', message => {
		console.log(`Child-master event test (child-a => master):\n`.green + `${message}`);
	});

	// Emit event test
	setTimeout(() => {
		const time = new Date().toISOString().slice(14, 19);
		ipc.emit('test-event', `Event emitted from master after 500 milliseconds: ${time} (m:s)`);
	}, 500);
})().catch(exc => console.error(exc.stack));
