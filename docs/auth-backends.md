# Auth backends

`ui/auth` generates login and register screens plus an in-memory
`AuthRepository`. That fake is only for local UI work.

It is **not** a generated Firebase, Supabase, or HTTP session. A later addon
should replace `AuthRepositoryHolder.repository` (or the bound implementation)
and keep the existing screens and validation.

Planned follow-ups, not in the catalog as generatable addons today:

- `auth/firebase` — Firebase Authentication
- `auth/supabase` — Supabase Auth
- `auth/api` — a backend you operate

The generated project also includes `docs/AUTH.md` with the same warning and
the demo account (`demo@example.com` / `demo-password`) used only to exercise
the screens.
