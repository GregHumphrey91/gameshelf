# Auth (Phase 2 placeholder)

This folder is intentionally empty in Phase 1. Phase 2 adds:

- JWT bearer validation against the OIDC provider (issuer + audience).
- A `Users` table and a role-resolution service that looks the caller up by
  their `sub` claim and reads the role from *our* database, never from the
  identity token's claims.
- Authorization policies applied to `GamesController`.

See `PROJECT_PLAN.md` → Phase 2.
