# Native addons: Rust and Zig FFI contracts

F0 prepares contracts only. No native sources, `.so` files or build
infrastructure are shipped, and no generated project requires Rust or Zig.

## Boundary

```text
Kotlin (packageName.nativebridge)
  -> JNI wrapper (hand-written, per addon)
    -> stable C ABI
      -> Rust cdylib (cargo-ndk)
      -> Zig 0.17.1 shared library (export fn, C ABI)
```

Prefer a **stable C ABI** over exposing C++ or Rust symbols. JNI names are
mangled and unstable; keep them in a thin Kotlin-facing wrapper.

## Targets

- `arm64-v8a` first (devices).
- `x86_64` for emulator tests.
- 16 KB ELF alignment and uncompressed packaging (see `docs/compatibility.md`).

## Ownership and errors

- Kotlin owns buffers it passes in; native code must not retain pointers after
  return unless the contract says so explicitly.
- Every allocation crossing the boundary has a documented free function.
- Use explicit result codes (`0` success, negative values for errors) plus a
  `thread_local`/explicit error-buffer accessor. Never throw C++ exceptions
  across JNI.
- JNI wrappers translate native codes into typed Kotlin sealed results; they
  must not leak `Throwable` from native code.
- Strings are UTF-8 with explicit length; no NUL-terminated assumptions for
  binary data.

## Rust

- Build with `cargo-ndk` and `--release`.
- `crate-type = ["cdylib"]`, `#[no_mangle] pub extern "C"` exports.
- Panics must be caught (`catch_unwind`) at the boundary and mapped to an error
  code; unwinding across FFI is undefined behavior.
- `jni` crate only inside the JNI wrapper, not in the core crate.

## Zig 0.17.1

- `export fn` with C-compatible types; no Zig error unions across the boundary.
- Build with `-target aarch64-linux-android` / `x86_64-linux-android` and link
  the NDK sysroot.
- Validate against the installed toolchain at addon implementation time. The
  local environment has Zig 0.16.0; **0.17.1 is the pinned contract target**, and
  F0 does not build Zig code.

## Packaging and 16 KB pages

- `.so` files go under `app/src/main/jniLibs/<abi>/`.
- AGP 8.5.1+ packages uncompressed, aligned libraries; AGP 9.5.1 is used.
- Verify with `zipalign -c -P 16 -v 4 app-debug.apk` and
  `llvm-objdump -p lib.so | grep LOAD` (align must be `2**14`).
- Addon docs must state ABI support and alignment status.

## Non-goals

Do not add FFI for work Kotlin does well (UI, persistence, networking). Addons
must justify native code with CPU, memory, portability or existing-library
reasons.
