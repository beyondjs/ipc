# SerializableError

`SerializableError` is part of the IPC layer and is designed to **preserve and transmit the full error cause tree**
across processes.

Normally, when an `Error` with a `cause` (or nested causes) is sent over IPC, only the top-level message survives—losing
the full chain of what actually happened. This class **serializes** the error into a plain JSON object, keeping every
cause in the chain intact, and can then **deserialize** it back into an equivalent error on the receiving side.

---

## How it works

-   Traverses the `cause` tree recursively, building a JSON-safe model.
-   Supports `Error` and non-`Error` causes.
-   Prevents infinite loops by detecting circular references.
-   Integrates with `JSON.stringify` via `toJSON()`.

---

## Quick usage

```ts
import { SerializableError } from '@beyond-js/ipc/error';

// Sender side
try {
	try {
		throw new SerializableError('Base failure');
	} catch (inner) {
		throw new SerializableError('Wrapper failure', { cause: inner });
	}
} catch (err) {
	const json = JSON.stringify(err); // Full cause tree preserved
	send(json);
}

// Receiver side
const parsed = JSON.parse(receivedJson);
const restored = SerializableError.deserialize(parsed);

console.error(restored.message); // "Wrapper failure"
console.error((restored.cause as Error).message); // "Base failure"
```

---

## API

```ts
new SerializableError(message: string, options?: { cause?: unknown })
serialize(): IErrorModel
toJSON(): IErrorModel // Enables direct JSON.stringify
static deserialize(model: IErrorModel): SerializableError
```
