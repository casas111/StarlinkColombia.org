import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { DEFAULT_OAUTH_SCOPE, OAUTH_ISSUER } from "../lib/oauth.js";
import { createStarlinkMcpServer } from "./create-server.mjs";

const corsHeaders = {
  "access-control-allow-headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "MCP-Protocol-Version, WWW-Authenticate",
  "cache-control": "no-store",
};

export function createMcpHttpHandler({ authorize, createBackend }) {
  if (typeof authorize !== "function" || typeof createBackend !== "function") {
    throw new Error("MCP HTTP authorization and backend factories are required");
  }

  return async function handleMcpHttpRequest(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    if (request.method !== "POST") {
      return withHeaders(
        Response.json(
          { error: "Method not allowed" },
          { headers: { allow: "POST, OPTIONS" }, status: 405 },
        ),
      );
    }

    const token = readBearerToken(request);
    if (!token || !(await authorize(request))) {
      return withHeaders(
        Response.json(
          { error: "Unauthorized" },
          {
            headers: {
              "www-authenticate": `Bearer realm="starlink-colombia-mcp", resource_metadata="${OAUTH_ISSUER}/.well-known/oauth-protected-resource", scope="${DEFAULT_OAUTH_SCOPE}"`,
            },
            status: 401,
          },
        ),
      );
    }

    const backend = createBackend({ request, token });
    const server = createStarlinkMcpServer({ backend });
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return withHeaders(await transport.handleRequest(request));
  };
}

function readBearerToken(request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

function withHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(response.body, { headers, status: response.status, statusText: response.statusText });
}
