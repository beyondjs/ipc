require('colors');
const BEE = require('@beyond-js/bee');

BEE('http://localhost:1110', { inspect: 4000 });

(async () => {
	const { ipc } = await bimport('@beyond-js/ipc/child');

	// Register the 'ping' handler for the child process
	ipc.handle('ping', message => `pong from child-a: ${message}`);

	// Child-master test
	const response = await ipc.exec('main', 'ping', 'Hello world!');
	console.log(`Child-master exec test:\n`.green + `${response}`);

	// Event emit test
	setTimeout(() => {
		const time = new Date().toISOString().slice(14, 19);
		ipc.emit('test-event', `Event emitted from child-a after 1000 milliseconds: ${time} (m:s)`);
	}, 1000);
})().catch(exc => console.error(exc.stack));
