import ipc from '@beyond-js/ipc/main';

// Register an action handler for 'get-data'
ipc.handle('get-data', async params => {
	// Here you can perform asynchronous logic like database queries or computations
	return { message: 'Hello from the child process!', received: params };
});

// Once the child process is up, notify the main process that it is ready.
// A small delay can ensure that the main process has already registered event listeners.
setTimeout(() => {
	ipc.notify('child-ready', { status: 'Child process is ready to work!' });
}, 100);
