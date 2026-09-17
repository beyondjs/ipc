# SerializableError

SerializableError supplies static serialize, deserialize and print methods. Its wire model contains message, stack and recursive cause. It rebuilds plain Error instances, not arbitrary subclasses/properties. No toJSON method or circular-cause detection exists.

Read the [complete behavior and lifecycle contract](../../docs/architecture.md#error-representation) before extending or integrating this module. Internal source files are not separate public module identities.
