# Action execution flow

The public call is `ipc.exec(target, action, ...params)`. Main executes its own actions directly; other calls use a UUID-correlating Dispatcher.

| Caller and target | Execution path |
| --- | --- |
| Main to main | MainProcessHandler.exec → Actions.exec → local callback |
| Main to child | Actions.dispatch → child router → Dispatcher → child Actions callback → matching response |
| Child to main | Child Dispatcher → parent router for that child → main Actions.exec → response to original request |
| Child to child | Origin Dispatcher → parent origin router → target Dispatcher with new request ID → target callback → parent forwards result using original ID |

Parameters are positional and responses contain data or serialized error. Registration does not await child handler readiness; no timeout or disconnect rejection protects unfinished requests. Read [wire and failure contracts](docs/architecture.md#action-flow-and-wire-contract).
