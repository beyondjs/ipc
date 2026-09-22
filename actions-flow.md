# Action execution flow

The public call is `ipc.exec(target, action, ...params)`. The parent executes its own actions directly; other calls use a UUID-correlating Dispatcher.

| Caller and target | Execution path |
| --- | --- |
| Main to main | MainProcessHandler.exec → Actions.exec → local callback |
| Main to child | Actions.dispatch → the child's router → Dispatcher → the child's Actions callback → matching response |
| Child to main | The child's Dispatcher → the parent's router for that child → main Actions.exec → response with the original identifier |
| Child to child | The origin's Dispatcher → the parent's origin router → the target's Dispatcher with a new identifier → the target's callback → the parent answers the origin with its identifier |

Parameters are positional; a response carries data or a serialized error, and a rejected action always answers with an error. A child that exits or is unregistered rejects what it owed; no request timeout exists. Read [the wire and lifecycle contracts](docs/architecture.md#actions-and-the-wire-contract).
