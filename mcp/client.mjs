const DEFAULT_BACKEND_URL = "https://starlinkcolombia.org";

export class BackendRequestError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "BackendRequestError";
    this.status = status;
    this.body = body;
  }
}

export function createBackendClient({
  baseUrl = process.env.STARLINK_BACKEND_URL || DEFAULT_BACKEND_URL,
  token = process.env.STARLINK_MCP_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  const origin = normalizeBackendUrl(baseUrl);
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("STARLINK_MCP_TOKEN is required");
  }
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");

  return {
    async request(path, { body, method = "GET" } = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetchImpl(new URL(path, origin), {
          body: body === undefined ? undefined : JSON.stringify(body),
          headers: {
            accept: "application/json",
            authorization: `Bearer ${token.trim()}`,
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            "x-mcp-request-id": crypto.randomUUID(),
          },
          method,
          signal: controller.signal,
        });
        const responseBody = await parseResponse(response);
        if (!response.ok) {
          const detail =
            responseBody && typeof responseBody === "object" && "error" in responseBody
              ? String(responseBody.error)
              : `Backend returned HTTP ${response.status}`;
          throw new BackendRequestError(detail, response.status, responseBody);
        }
        return responseBody;
      } catch (error) {
        if (error instanceof BackendRequestError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new BackendRequestError("Backend request timed out", 504, null);
        }
        throw new BackendRequestError(
          error instanceof Error ? error.message : "Backend request failed",
          502,
          null,
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function normalizeBackendUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("STARLINK_BACKEND_URL must be a valid URL");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("STARLINK_BACKEND_URL must use HTTPS, except for localhost");
  }
  url.pathname = url.pathname.replace(/\/*$/u, "/");
  url.search = "";
  url.hash = "";
  return url;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new BackendRequestError("Backend returned invalid JSON", response.status, text.slice(0, 1000));
  }
}
