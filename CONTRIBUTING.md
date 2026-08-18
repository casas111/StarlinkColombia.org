# Cómo contribuir

Los cambios entran por pull request y se publican únicamente por decisión explícita del propietario del Site.

## Flujo

1. Crea una rama desde `main` con un nombre descriptivo, por ejemplo `feat/nombre-corto` o `fix/nombre-corto`.
2. Mantén el cambio acotado y no mezcles mutaciones de producción con cambios de código.
3. Ejecuta `npm run lint` y `npm test`.
4. Si modificaste `db/schema.ts`, ejecuta `npm run db:generate`, conserva todas las migraciones aplicadas y revisa el SQL nuevo.
5. Abre un pull request, espera CI y solicita revisión del propietario indicado en `CODEOWNERS`.

## Límites de seguridad

- No subas secretos, tokens MCP, `.env` poblados, exports de D1, objetos R2 ni datos personales de producción.
- No cambies el `project_id` ni los bindings `DB` y `BUCKET` de `.openai/hosting.json`.
- No borres ni edites migraciones ya aplicadas. Toda evolución de D1 es forward-only.
- Un merge no autoriza publicar el Site, aplicar una migración o modificar datos de producción.

Quien solo necesite colaborar con código puede trabajar desde un fork. Quien deba empujar ramas al repositorio necesita acceso `Write`; el acceso `Maintain` debe reservarse para quienes administren el repositorio, no la producción.
