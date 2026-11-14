# Template fragments

Fragments are small, local source snippets that addons append or insert into a
generated project. They are keyed by the `template` field of an addon
`fileOperations` entry, for example `storage/room-database` resolves to
`storage/room-database.txt`.

Rules:

- Fragments are local files. Remote templates are never downloaded.
- Fragment ids match `^[a-z0-9-]+(/[a-z0-9-]+)*$` and may not contain `..`.
- Addons in `planned` or `experimental` state must not declare file operations.
- No fragment is used until a `stable` or `beta` addon declares it.

F0 ships this directory empty on purpose: the catalog is declarative and no
addon is generatable yet.
