# Dispatcher

`new Dispatcher(fork?)` sends UUID-correlated requests through a child process, or through `process` in a child. `exec(target, action, ...params)` answers with the matching response; a send failure, a channel disconnect, the exit of the fork and `destroy()` reject the requests still pending, which `pending` counts. There is no timeout.

Read [the contract](../../docs/architecture.md#actions-and-the-wire-contract) before extending or integrating this module.
