# SerializableError

Static `serialize`, `deserialize` and `print`. The wire model is `{ message, stack, cause? }`: an Error with its cause chain, a string as it is, other values as JSON or string form, and a cause already on the chain cut as `[circular cause]`. Deserialization rebuilds plain Error instances with their chain.

Read [the contract](../../docs/architecture.md#errors) before extending or integrating this module.
