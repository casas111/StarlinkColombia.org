import { OAuthProtocolError } from "./oauth.js";

const baseHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  pragma: "no-cache",
};

export function oauthJson(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { headers: { ...baseHeaders, ...headers }, status });
}

export function oauthError(error: unknown) {
  if (error instanceof OAuthProtocolError) {
    return oauthJson({ error: error.code, error_description: error.message }, error.status);
  }
  console.error("OAuth request failed", error);
  return oauthJson({ error: "server_error", error_description: "OAuth request failed" }, 500);
}

export function oauthOptions() {
  return new Response(null, {
    headers: {
      ...baseHeaders,
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
    status: 204,
  });
}

export function assertSmallRequest(request: Request, maxBytes = 32_768) {
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > maxBytes) {
    throw new OAuthProtocolError("invalid_request", "The OAuth request is too large", 413);
  }
}
