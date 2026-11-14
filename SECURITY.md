# Security policy

## Supported versions

F0 is pre-release. Security fixes are applied to the `main` branch only.

## Reporting

Report suspected vulnerabilities privately to the maintainers of the repository
where you obtained it. Do not open a public issue with exploit details. Include
the affected endpoint/command, a minimal request, observed behavior and impact.
No bounty program is offered.

## Threat model (F0)

Protected assets:

- the host running the Initializr (filesystem, process, credentials);
- users of generated projects (no injected malicious code);
- repository integrity (templates and catalog).

In scope:

- path traversal / zip-slip through project names, package names or addon paths;
- oversized requests or ZIPs (limits: 32 KiB request, 200 files, 8 MiB, 2 MiB
  per file);
- ZIP parsing/writing flaws (duplicate entries, encryption, data descriptors,
  unsupported methods, CRC mismatch);
- template injection through unvalidated variables;
- leaking stack traces or absolute paths in API errors;
- secrets in generated projects.

Out of scope in F0:

- authentication/authorization (no accounts exist);
- remote code execution by design (no user scripts, no remote templates);
- database services, Turso Sync, native FFI execution;
- denial of service from a trusted local operator running builds.

## Practices

- Strict Zod schemas reject unknown fields.
- Identifiers are validated against Kotlin/Java keywords and filesystem rules.
- Generated paths are re-validated when writing and when reading ZIPs.
- The ZIP is re-read and hash-compared with the plan before download.
- Templates are embedded and drift-checked; nothing is fetched at runtime.
- Templates contain no `.env`, tokens, keystores or `local.properties`.
- Generated apps declare no network permission by default.
- Addon manifests in `planned`/`experimental` state are never generated.
