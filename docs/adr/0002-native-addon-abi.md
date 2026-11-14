# ADR 0002: Stable C ABI for native addons

- **Status:** Accepted (contract only; no implementation in F0)
- **Date:** 2026-11-13

## Context

Future addons may ship Rust (`cdylib` via cargo-ndk) or Zig 0.17.1 libraries.
Exposing C++ symbols or JNI-mangled Rust symbols couples addons to compiler and
toolchain details. The minimum template must not install Rust or Zig.

## Decision

Native addons expose a **stable C ABI**. Kotlin talks to it through a thin,
addon-owned JNI wrapper. Zig uses `export fn` with C-compatible types; Rust uses
`#[no_mangle] pub extern "C"` with `catch_unwind` at the boundary. Errors are
explicit numeric codes with a documented accessor, never exceptions across FFI.

Initial ABIs: `arm64-v8a` and `x86_64`. Libraries must be 16 KB ELF-aligned and
packaged uncompressed. Ownership and free functions are documented per addon.

## Consequences

- Addon ABI is independent of Rust/Zig internals and JNI name mangling.
- JNI wrappers are small and testable; core logic stays in the native crate.
- FFI is optional: the minimal template has no native code and no Rust/Zig
  requirement.
- Zig 0.17.1 is pinned for the future addon; the current machine has 0.16.0, which
  is irrelevant to F0 because no Zig code is built.
