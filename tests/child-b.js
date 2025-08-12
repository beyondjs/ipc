require('colors');
const BEE = require('@beyond-js/bee');

BEE('http://localhost:1110', { inspect: 4000 });

(async () => {
	const { ipc } = await bimport('@beyond-js/ipc/wrapper');

	// Register the 'ping' handler for the child process
	ipc.handle('ping', message => `pong from child-b: ${message}`);

	// Child-child test
	const response = await ipc.exec('child-a', 'ping', 'Hello world!');
	console.log(`Child-child (child-b => child-a) exec test:\n`.green + `${response}`);

	// Event subscriptions test
	const onmain = message => {
		console.log(`Master-child event test (main => child-b):\n`.green + `${message}`);
		ipc.off('main', 'test-event', onmain);
	};
	const onchild = message => {
		console.log(`Child-child event test (child-a => child-b):\n`.green + `${message}`);
		ipc.off('child-a', 'test-event', onchild);
	};

	ipc.on('main', 'test-event', onmain);
	ipc.on('child-a', 'test-event', onchild);
})().catch(exc => console.error(exc.stack));
