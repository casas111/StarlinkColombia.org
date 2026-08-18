# Contexto del proyecto

## Propósito y operación

Conecta Colombia recibe solicitudes de conectividad, permite priorizarlas y mantiene el inventario histórico de operaciones Starlink. El sitio público es `https://starlinkcolombia.org` y el proyecto de OpenAI Sites es `appgprj_6a81d6d346cc81918cd340dec886d821`.

Conecta Colombia es una iniciativa independiente de coordinación humanitaria. No está afiliada, patrocinada ni operada por Starlink o SpaceX; las referencias a esas marcas describen únicamente la tecnología de conectividad gestionada por el portal. El MCP se presenta públicamente como **Conecta Colombia Operations MCP** para evitar cualquier apariencia de servicio oficial del fabricante.

El Google Sheet operativo central tiene ID `19Kiz4i6-BtG_7aVcuWHlS5KZWYMZFlA3ZVbcK4tK1gM`.

## Arquitectura

- Next.js/React/Vinext ejecutándose como Cloudflare Worker.
- Cloudflare D1 enlazado como `DB` para datos relacionales.
- Cloudflare R2 enlazado como `BUCKET` para evidencias y contratos.
- Drizzle ORM define el modelo en `db/schema.ts`; `drizzle/` contiene migraciones forward-only.
- Un MCP remoto por Streamable HTTP, alojado en `/api/mcp` dentro del mismo Site, traduce herramientas explícitas a rutas administrativas autenticadas. OAuth 2.1 aporta descubrimiento, DCR, consentimiento con ChatGPT, PKCE, refresh rotation y revocación. El transporte STDIO y los bearer tokens firmados se conservan como compatibilidad; ninguno expone SQL ni acceso directo a R2.
- La configuración de Sites vive en `.openai/hosting.json` y debe conservarse.

Tablas D1 actuales:

- `applications`
- `operation_promotions`
- `admins`
- `admin_invites`
- `activities`
- `mcp_audit_logs`
- `oauth_clients`
- `oauth_authorization_codes`
- `oauth_tokens`
- `allocations`
- `allocation_overrides`
- `operational_evidence`
- `donation_accounts`
- `donation_account_assignments`

## Variables de entorno

- `HERMES_WEBHOOK_SECRET`: autentica `/api/hermes/intake`.
- `SHEET_SYNC_TOKEN`: bearer token para `/api/sync/starlink` y `/api/sync/promotions`.
- `OPENAI_API_KEY`: habilita la evaluación asistida de prioridad.
- `OPENAI_PRIORITY_MODEL`: modelo de prioridad; por defecto `gpt-5.6-terra`.
- `MCP_AUTH_SECRET`: verifica tokens MCP firmados por operador.
- `STARLINK_BACKEND_URL`: configuración exclusiva del transporte STDIO local.
- `STARLINK_MCP_TOKEN`: token individual usado por clientes MCP remotos o locales; nunca se versiona.

Solo se versionan los nombres en `.env.example`. Los valores reales se administran en el entorno de hosting.

## Flujos de sincronización

### Inventario histórico hacia el portal

1. Se leen valores formateados de `Starlink!A1:O300`.
2. Se envía `{"rows": <valores>}` por `POST /api/sync/starlink` con bearer token.
3. `lib/sheet-sync.ts` hace upsert por número de fila de origen.
4. La ausencia de una fila en el Sheet no elimina registros del portal.
5. Las entradas históricas no se promueven automáticamente.

Las siguientes operaciones están protegidas y deben permanecer en `delivery` (“En entrega”):

- Cruz Roja — Quibdó: 4 unidades.
- SOS Chocó: 6 unidades.
- Brigadas médicas — Daniel Madero: 5 unidades.

Las demás entradas históricas deben permanecer en `new` (“Entradas por migrar”) hasta una promoción explícita.

### Solicitudes nuevas hacia el Sheet

Los registros de `applications` cuyo `status` sea exactamente `new` se reflejan en la pestaña `Solicitudes nuevas`. La columna Referencia es la llave única: se actualiza la fila existente o se agrega una nueva, sin duplicar referencias ni borrar filas históricas.

### Promociones

`/api/sync/promotions` expone la cola de promociones explícitas. Una sincronización nunca debe equivaler a una promoción automática.

## Incidencia conocida que requiere regresión

En una revisión del 17 de agosto de 2026, las tres operaciones protegidas aparecieron como `new` y sus cantidades (`4`, `6`, `5`) quedaron desplazadas a columnas incorrectas, mientras `units` tomó el valor `1`. Antes de cambiar el sincronizador se debe:

1. Comparar el orden real de los encabezados formateados de `Starlink!A1:O300` con el mapeo posicional de `lib/sheet-sync.ts`.
2. Añadir una prueba de regresión con las tres operaciones protegidas.
3. Confirmar que la sincronización sea idempotente y no elimine datos.
4. Corregir producción solo mediante una operación explícita, auditada y separada del cambio de código.

## Flujo de trabajo

1. Crear una rama y hacer cambios pequeños y revisables.
2. Ejecutar `npm run lint` y `npm test`; para esquema, también `npm run db:generate`.
3. Abrir un pull request. No incluir secretos, exports de D1 ni archivos de R2.
4. Tras CI y revisión satisfactorios, fusionar y publicar el cambio en el Site existente, salvo que el propietario haya pedido explícitamente trabajo solo local, de planificación o solo PR.
5. La publicación sigue siendo un paso separado y verificable. Nunca implica autorización para migraciones D1, reparaciones de datos, mutaciones R2 ni infraestructura nueva; esas acciones conservan su propia aprobación y alcance explícitos.
