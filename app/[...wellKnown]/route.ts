import { authorizationServerMetadata, protectedResourceMetadata } from "../../lib/oauth.js";
import { oauthJson } from "../../lib/oauth-http";

export const dynamic = "force-dynamic";

const protectedResourcePaths = new Set([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/api/mcp",
]);

export async function GET(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/$/u, "") || "/";
  if (protectedResourcePaths.has(pathname)) return oauthJson(protectedResourceMetadata());
  if (pathname === "/.well-known/oauth-authorization-server") {
    return oauthJson(authorizationServerMetadata());
  }
  return oauthJson({ error: "Not found" }, 404);
}
