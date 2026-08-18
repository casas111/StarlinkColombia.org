## Qué cambia

Describe el resultado y la razón del cambio.

## Validación

- [ ] Ejecuté `npm run lint`.
- [ ] Ejecuté `npm test`.
- [ ] Si cambié `db/schema.ts`, ejecuté `npm run db:generate` y revisé el SQL.
- [ ] Revisé el diff y no contiene secretos, datos D1 ni objetos R2.
- [ ] Conservé `.openai/hosting.json`, su `project_id` y los bindings `DB`/`BUCKET`.

## Operación

- [ ] Este PR no presupone ni ejecuta publicación, migración D1 o mutación de datos de producción.
- [ ] Documenté por separado cualquier paso operativo que deba aprobar el propietario.
