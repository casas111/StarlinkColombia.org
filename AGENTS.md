# Codex working agreement

This repository is the source of truth for **Conecta Colombia — Solicitud Starlink**.

## Invariants

- Preserve `.openai/hosting.json`, including project ID `appgprj_6a81d6d346cc81918cd340dec886d821` and the `DB`/`BUCKET` bindings.
- Never commit production data, R2 objects, credentials, API keys, bearer tokens, or populated `.env` files.
- Synchronization must be idempotent. Missing Sheet rows must not delete portal history, and references must never be duplicated.
- Historical Starlink rows remain in `new` (shown as “Entradas por migrar”) unless an explicit workflow promotes them. The three protected operations documented in `docs/PROJECT_CONTEXT.md` remain in `delivery` (“En entrega”).
- Change the database through `db/schema.ts` and forward-only Drizzle migrations in `drizzle/`. Do not edit or delete an applied migration.
- Keep production mutations separate from code changes. A code review or merge does not authorize database edits, data migration, or deployment.

## Before handing off a change

Run:

```bash
npm run lint
npm test
```

After a schema change, also run `npm run db:generate` and review the generated SQL.

Codex may edit and validate this repository. Publishing through OpenAI Sites and any production database migration are separate, explicit owner actions.
