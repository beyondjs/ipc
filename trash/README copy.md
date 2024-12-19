# @beyond-js/ipc

A powerful Inter-Process Communication (IPC) library for Node.js applications, facilitating seamless communication
between the main process and child processes.

## Installation

```bash
npm install @beyond-js/ipc
```

## Usage

```javascript
const ipc = require('@beyond-js/ipc/main');

// In the main process
const main = ipc;

main.handle('greet', name => `Hello, ${name}!`);

main.register('worker1', childProcess);

main.events.on('worker1', 'ready', () => {
	console.log('Worker 1 is ready');
});

// In a child process
const child = ipc;

child.exec('main', 'greet', 'John').then(response => {
	console.log(response); // Outputs: Hello, John!
});

child.events.emit('ready');
```

## API

### Main Process

-   `handle(action: string, listener: Function)`: Register a handler for an action
-   `removeHandler(action: string)`: Remove a handler for an action
-   `register(name: string, fork: ChildProcess)`: Register a child process
-   `unregister(name: string)`: Unregister a child process
-   `exec(target: string, action: string, ...params: any[])`: Execute an action on a target process
-   `events.on(source: string, event: string, listener: Function)`: Listen for events from child processes
-   `events.emit(event: string, message: any)`: Emit an event to all child processes

### Child Process

-   `exec(target: string, action: string, ...params: any[])`: Execute an action on the main process or another child
    process
-   `events.on(source: string, event: string, listener: Function)`: Listen for events from the main process or other
    child processes
-   `events.emit(event: string, message: any)`: Emit an event to the main process

## Features

-   Bidirectional communication between main and child processes
-   Event-based messaging system
-   Action handling and execution across processes
-   Error handling and propagation
-   Automatic cleanup and resource management

## License

MIT © [[BeyondJS](https://beyondjs.com)]
