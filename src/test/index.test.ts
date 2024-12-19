import { fork, ChildProcess } from 'child_process';
import ipcMain from '@beyond-js/ipc/main';

describe('IPC integration test', () => {
	let child: ChildProcess;

	beforeAll(() => {
		// Fork the child process script.
		// Assume `child.js` is in the same directory and uses `@beyond-js/ipc/main` for child process logic.
		child = fork(`${__dirname}/child.js`, [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });

		// Register the child process under the name 'child-1'
		ipcMain.register('child-1', child);
	});

	afterAll(() => {
		// Clean up the child process and IPC
		ipcMain.unregister('child-1');
		child.kill();
	});

	test('should receive the "child-ready" event from child', async () => {
		const promise = new Promise((resolve, reject) => {
			// Set up a listener for the 'child-ready' event from the 'child-1' process
			ipcMain.events.on('child-1', 'child-ready', data => {
				try {
					expect(data).toHaveProperty('status', 'Child process is ready to work!');
					resolve(true);
				} catch (error) {
					reject(error);
				}
			});
		});

		// The child process is expected to emit this event shortly after start.
		await promise;
	});

	test('should execute the "get-data" action on child-1 and receive a response', async () => {
		// Call the action 'get-data' on the child process and await its result
		const params = { someParam: 'example' };
		const response = await ipcMain.exec('child-1', 'get-data', params);

		// Check that the response matches what the child is expected to return
		expect(response).toMatchObject({
			message: 'Hello from the child process!',
			received: params
		});
	});
});
