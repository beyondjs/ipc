# Dispatcher

Dispatcher(fork?) sends UUID-correlated requests through a ChildProcess or a child process channel. exec(target, action, ...params) waits for a matching response. It has no container parameter, timeout, disconnect rejection or pending-promise cleanup on destroy.

Read the [complete behavior and lifecycle contract](../../docs/architecture.md#action-flow-and-wire-contract) before extending or integrating this module. Internal source files are not separate public module identities.
