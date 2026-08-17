# Conecta Colombia — Solicitud Starlink

Portal público y tablero operativo para recibir, priorizar y gestionar solicitudes de conectividad Starlink en Colombia.

- Producción: [starlinkcolombia.org](https://starlinkcolombia.org)
- Plataforma: OpenAI Sites sobre Cloudflare Workers
- Aplicación: Next.js 16, React 19, Vinext y TypeScript
- Datos: Cloudflare D1 con Drizzle ORM
- Archivos: Cloudflare R2

## Desarrollo local

Requiere Node.js `>=22.13.0`.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Las variables se describen en `.env.example`; nunca deben subirse valores reales al repositorio.

## Comandos

```bash
npm run dev          # servidor local
npm run lint         # ESLint
npm test             # build verificado y pruebas
npm run db:generate  # migración Drizzle después de cambiar el schema
```

## Estructura

- `app/`: portal público, administración y rutas API.
- `db/`: conexión y esquema D1.
- `drizzle/`: migraciones versionadas y snapshots.
- `lib/`: sincronización con Sheets y evaluación de prioridad.
- `worker/`: entrada del Worker.
- `.openai/hosting.json`: identidad del proyecto Sites y bindings `DB`/`BUCKET`.

Lee [AGENTS.md](AGENTS.md) antes de hacer cambios y [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) para arquitectura, sincronización y operación.

## Publicación

GitHub contiene el código, el esquema y las migraciones, pero no los datos ni los secretos de producción. Publicar el sitio, aplicar una migración D1 o modificar datos requiere una acción explícita y separada del propietario.
