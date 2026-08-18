# MCP de operaciones Starlink Colombia

Este repositorio incluye un servidor MCP remoto por Streamable HTTP en el mismo Site y conserva un transporte local por STDIO para desarrollo. Ambos traducen herramientas explícitas a las rutas administrativas existentes; no abren acceso SQL, no descargan objetos R2 y no crean infraestructura adicional.

## Herramientas

- `list_applications` y `get_application`: lectura de solicitudes.
- `update_application`: estado, notas, responsable y campos permitidos.
- `list_allocations` y `get_allocation`: lectura del inventario histórico y sus overrides.
- `update_allocation`: override del portal sin sobrescribir la fuente de Google Sheets.
- `promote_application`: promoción explícita a operaciones; exige `confirm: true`.

Las mutaciones hechas con MCP quedan registradas en `mcp_audit_logs`. Los endpoints verifican scopes y además exigen que el correo del token sea el propietario o un registro activo en `admins`.

## Variables

- `MCP_AUTH_SECRET`: secreto de al menos 32 caracteres instalado en OpenAI Sites y conservado únicamente por el propietario que emite tokens. No se entrega a los operadores.
- `STARLINK_BACKEND_URL`: URL del backend; por defecto `https://starlinkcolombia.org`.
- `STARLINK_MCP_TOKEN`: token individual del operador. Nunca se versiona ni se comparte entre personas.

## Activación de producción

Estos son pasos operativos separados; un pull request no los ejecuta:

1. Revisar y aplicar la migración nueva de D1.
2. Crear un `MCP_AUTH_SECRET` fuerte y guardarlo como secreto del Site.
3. Publicar el código aprobado.
4. Asegurar que cada operador esté activo en `admins`; el propietario puede usar el flujo de invitación del portal.
5. Generar un token distinto por operador y entregarlo por un canal seguro.

El propietario puede emitir un token desde una copia segura del repositorio:

```bash
export MCP_AUTH_SECRET='valor-del-secreto-del-site'
npm run mcp:token -- --email developer@example.com --name 'Developer' --days 30
```

El comando acepta `--scopes data:read,data:write,operations:promote`. Conviene otorgar solo los scopes necesarios y usar expiraciones cortas.

## Conexión remota recomendada

El endpoint de producción es:

```text
https://starlinkcolombia.org/api/mcp
```

Cada operador configura su token individual fuera del repositorio:

```bash
export STARLINK_MCP_TOKEN='token-individual'
codex mcp add starlink_colombia \
  --url https://starlinkcolombia.org/api/mcp \
  --bearer-token-env-var STARLINK_MCP_TOKEN
```

La configuración equivalente en `~/.codex/config.toml` es:

```toml
[mcp_servers.starlink_colombia]
url = "https://starlinkcolombia.org/api/mcp"
bearer_token_env_var = "STARLINK_MCP_TOKEN"
default_tools_approval_mode = "writes"
```

El servidor usa Streamable HTTP sin sesiones persistentes. `POST` transporta el protocolo y `OPTIONS` permite la negociación CORS; `GET` y `DELETE` responden `405` de forma intencional. La autenticación ocurre antes de procesar cualquier mensaje MCP y las rutas administrativas vuelven a verificar identidad y scopes.

## Transporte local de respaldo

El proceso MCP se inicia así:

```bash
export STARLINK_MCP_TOKEN='token-individual'
export STARLINK_BACKEND_URL='https://starlinkcolombia.org'
npm run mcp:start
```

Para desarrollo del servidor, Codex también puede registrar el proceso STDIO y hacer que herede `STARLINK_MCP_TOKEN`. Por ejemplo, en `~/.codex/config.toml`, reemplazando la ruta absoluta:

```toml
[mcp_servers.starlink_colombia]
command = "node"
args = ["/ruta/absoluta/StarlinkColombia.org/mcp/server.mjs"]
env = { STARLINK_BACKEND_URL = "https://starlinkcolombia.org" }
env_vars = ["STARLINK_MCP_TOKEN"]
```

No guardes el token real en un archivo del repositorio. Para revocar a un operador no propietario, cambia su estado en `admins` a inactivo; para una revocación total, rota `MCP_AUTH_SECRET` y emite tokens nuevos.
