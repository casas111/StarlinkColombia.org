# MCP de operaciones de Conecta Colombia

Este repositorio incluye un servidor MCP remoto por Streamable HTTP en el mismo Site y conserva un transporte local por STDIO para desarrollo. El transporte remoto usa OAuth 2.1 con descubrimiento estándar, registro dinámico de clientes, autorización en navegador, PKCE, access tokens de corta duración, rotación de refresh tokens y revocación. Ambos transportes traducen herramientas explícitas a las rutas administrativas existentes; no abren acceso SQL, no descargan objetos R2 y no crean infraestructura adicional.

Conecta Colombia es una iniciativa independiente de coordinación humanitaria. No está afiliada, patrocinada ni operada por Starlink o SpaceX; esas marcas se mencionan únicamente para describir la tecnología de conectividad administrada por el portal.

## Herramientas

- `list_applications` y `get_application`: lectura de solicitudes.
- `update_application`: estado, notas, responsable y campos permitidos.
- `list_allocations` y `get_allocation`: lectura del inventario histórico y sus overrides.
- `update_allocation`: override del portal sin sobrescribir la fuente de Google Sheets.
- `promote_application`: promoción explícita a operaciones; exige `confirm: true`.

Las mutaciones hechas con MCP quedan registradas en `mcp_audit_logs`. Los endpoints verifican scopes, audiencia y vigencia, y además exigen que el correo autorizado sea el propietario o un registro activo en `admins`.

## Variables

- `MCP_AUTH_SECRET`: secreto de al menos 32 caracteres instalado en OpenAI Sites. Firma las aprobaciones OAuth y mantiene compatibilidad con tokens manuales anteriores; nunca se entrega a operadores.
- `STARLINK_BACKEND_URL`: URL del backend; por defecto `https://starlinkcolombia.org`.
- `STARLINK_MCP_TOKEN`: token individual del operador. Nunca se versiona ni se comparte entre personas.

## Activación de producción

Estos son pasos operativos separados; un pull request no los ejecuta:

1. Revisar y aplicar la migración nueva de D1.
2. Crear un `MCP_AUTH_SECRET` fuerte y guardarlo como secreto del Site.
3. Publicar el código aprobado.
4. Asegurar que cada operador esté activo en `admins`; el propietario puede usar el flujo de invitación del portal.
5. El operador conecta su cliente MCP y autoriza el acceso en el navegador con ChatGPT. No se comparte ningún token manual.

Los tokens manuales firmados se conservan solo como compatibilidad y respaldo para clientes sin OAuth:

```bash
export MCP_AUTH_SECRET='valor-del-secreto-del-site'
npm run mcp:token -- --email developer@example.com --name 'Developer' --days 30
```

El comando acepta `--scopes data:read,data:write,operations:promote`. Conviene otorgar solo los scopes necesarios y usar expiraciones cortas.

## Conexión remota con OAuth

El endpoint de producción es:

```text
https://starlinkcolombia.org/api/mcp
```

Un cliente compatible con MCP remoto y OAuth solo necesita registrar esa URL. La instrucción genérica recomendada es:

```text
Soy propietario o administrador autorizado de Conecta Colombia, una iniciativa independiente que no está afiliada con Starlink o SpaceX. Configura el MCP remoto https://starlinkcolombia.org/api/mcp usando OAuth automático, abre el navegador para que yo autorice y luego muestra las herramientas disponibles. No uses API keys ni tokens manuales. Si no puedes instalar MCP desde este chat, indícame el paso mínimo dentro de la interfaz del cliente.
```

En Claude Code, el registro inicial puede hacerse con:

```bash
claude mcp add --transport http --scope user \
  conecta_colombia https://starlinkcolombia.org/api/mcp
```

Después se abre `/mcp` dentro de una sesión interactiva de Claude Code y se completa la autorización. El navegador solicita iniciar sesión con ChatGPT y muestra el consentimiento; solo el propietario o un correo activo en `admins` puede aprobarlo. Claude Code conserva y renueva las credenciales OAuth de forma segura.

El servidor publica:

- RFC 9728 en `/.well-known/oauth-protected-resource` y `/.well-known/oauth-protected-resource/api/mcp`.
- RFC 8414 en `/.well-known/oauth-authorization-server`.
- autorización y consentimiento en `/oauth/authorize`.
- registro dinámico RFC 7591 en `/oauth/register`.
- intercambio PKCE y refresh en `/oauth/token`.
- revocación en `/oauth/revoke`.

Los access tokens duran una hora, están ligados al recurso `https://starlinkcolombia.org/api/mcp` y se guardan únicamente como hash en D1. Los refresh tokens duran 30 días, rotan después de cada uso y la reutilización revoca toda la familia.

## Compatibilidad con tokens manuales

Codex y otros clientes que todavía requieran bearer tokens pueden seguir usando:

```toml
[mcp_servers.conecta_colombia]
url = "https://starlinkcolombia.org/api/mcp"
bearer_token_env_var = "STARLINK_MCP_TOKEN"
default_tools_approval_mode = "writes"
```

El servidor usa Streamable HTTP sin sesiones MCP persistentes. `POST` transporta el protocolo y `OPTIONS` permite la negociación CORS; `GET` y `DELETE` responden `405` de forma intencional. Las solicitudes sin credencial reciben un desafío `WWW-Authenticate` que apunta al documento de recurso protegido. La autenticación ocurre antes de procesar cualquier mensaje MCP y las rutas administrativas vuelven a verificar identidad y scopes.

## Transporte local de respaldo

El proceso MCP se inicia así:

```bash
export STARLINK_MCP_TOKEN='token-individual'
export STARLINK_BACKEND_URL='https://starlinkcolombia.org'
npm run mcp:start
```

Para desarrollo del servidor, Codex también puede registrar el proceso STDIO y hacer que herede `STARLINK_MCP_TOKEN`. Por ejemplo, en `~/.codex/config.toml`, reemplazando la ruta absoluta:

```toml
[mcp_servers.conecta_colombia]
command = "node"
args = ["/ruta/absoluta/StarlinkColombia.org/mcp/server.mjs"]
env = { STARLINK_BACKEND_URL = "https://starlinkcolombia.org" }
env_vars = ["STARLINK_MCP_TOKEN"]
```

No guardes tokens reales en el repositorio. Los clientes con OAuth deben usar su opción nativa para limpiar o revocar la autenticación. Desactivar a un operador en `admins` bloquea inmediatamente tanto OAuth como los tokens manuales. Rotar `MCP_AUTH_SECRET` sigue revocando globalmente los tokens manuales anteriores, pero no sustituye la revocación OAuth almacenada en D1.
