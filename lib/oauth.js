export const OAUTH_ISSUER = "https://starlinkcolombia.org";
export const MCP_RESOURCE = `${OAUTH_ISSUER}/api/mcp`;
export const OAUTH_SCOPES = ["data:read", "data:write", "operations:promote"];
export const DEFAULT_OAUTH_SCOPE = OAUTH_SCOPES.join(" ");
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/u;

export class OAuthProtocolError extends Error {
  constructor(code, description, status = 400) {
    super(description);
    this.name = "OAuthProtocolError";
    this.code = code;
    this.status = status;
  }
}

export function protectedResourceMetadata() {
  return {
    authorization_servers: [OAUTH_ISSUER],
    bearer_methods_supported: ["header"],
    resource: MCP_RESOURCE,
    resource_documentation: "https://github.com/casas111/StarlinkColombia.org/blob/main/docs/MCP.md",
    resource_name: "Starlink Colombia Operations MCP",
    scopes_supported: OAUTH_SCOPES,
  };
}

export function authorizationServerMetadata() {
  return {
    authorization_endpoint: `${OAUTH_ISSUER}/oauth/authorize`,
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    issuer: OAUTH_ISSUER,
    protected_resources: [MCP_RESOURCE],
    registration_endpoint: `${OAUTH_ISSUER}/oauth/register`,
    response_modes_supported: ["query"],
    response_types_supported: ["code"],
    revocation_endpoint: `${OAUTH_ISSUER}/oauth/revoke`,
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: OAUTH_SCOPES,
    token_endpoint: `${OAUTH_ISSUER}/oauth/token`,
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export function normalizeClientRegistration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OAuthProtocolError("invalid_client_metadata", "A JSON client registration is required");
  }
  const redirectUris = Array.isArray(input.redirect_uris)
    ? [...new Set(input.redirect_uris.map((value) => String(value)))]
    : [];
  if (redirectUris.length === 0 || redirectUris.length > 10) {
    throw new OAuthProtocolError("invalid_redirect_uri", "Provide between one and ten redirect URIs");
  }
  for (const redirectUri of redirectUris) validateRedirectUri(redirectUri);

  const tokenMethod = String(input.token_endpoint_auth_method ?? "none");
  if (tokenMethod !== "none") {
    throw new OAuthProtocolError("invalid_client_metadata", "Only public clients are supported");
  }
  const grantTypes = arrayOrDefault(input.grant_types, ["authorization_code", "refresh_token"]);
  if (
    !grantTypes.includes("authorization_code") ||
    grantTypes.some((value) => !["authorization_code", "refresh_token"].includes(value))
  ) {
    throw new OAuthProtocolError("invalid_client_metadata", "Unsupported grant type");
  }
  const responseTypes = arrayOrDefault(input.response_types, ["code"]);
  if (responseTypes.length !== 1 || responseTypes[0] !== "code") {
    throw new OAuthProtocolError("invalid_client_metadata", "Only the authorization code response is supported");
  }

  return {
    clientName: cleanText(input.client_name, "MCP client", 120),
    clientUri: optionalHttpsUri(input.client_uri),
    grantTypes: ["authorization_code", "refresh_token"],
    redirectUris,
    responseTypes,
    tokenEndpointAuthMethod: tokenMethod,
  };
}

export function validateAuthorizationRequest(searchParams, client) {
  if (searchParams.get("response_type") !== "code") {
    throw new OAuthProtocolError("unsupported_response_type", "Only response_type=code is supported");
  }
  const clientId = searchParams.get("client_id") || "";
  if (!client || client.clientId !== clientId) {
    throw new OAuthProtocolError("invalid_request", "Unknown OAuth client");
  }
  const redirectUri = searchParams.get("redirect_uri") || "";
  if (!client.redirectUris.includes(redirectUri)) {
    throw new OAuthProtocolError("invalid_request", "The redirect URI is not registered");
  }
  const codeChallenge = searchParams.get("code_challenge") || "";
  if (searchParams.get("code_challenge_method") !== "S256" || !CODE_CHALLENGE_PATTERN.test(codeChallenge)) {
    throw new OAuthProtocolError("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  return {
    clientId,
    codeChallenge,
    redirectUri,
    resource: normalizeResource(searchParams.get("resource")),
    scope: normalizeScope(searchParams.get("scope")),
    state: (searchParams.get("state") || "").slice(0, 2000),
  };
}

export function normalizeScope(value, allowedScope = DEFAULT_OAUTH_SCOPE) {
  const requested = String(value || allowedScope).trim().split(/\s+/u).filter(Boolean);
  const allowed = new Set(String(allowedScope).split(/\s+/u).filter(Boolean));
  const unique = [...new Set(requested)];
  if (unique.length === 0 || unique.some((scope) => !OAUTH_SCOPES.includes(scope) || !allowed.has(scope))) {
    throw new OAuthProtocolError("invalid_scope", "One or more requested scopes are not available");
  }
  return unique.join(" ");
}

export function normalizeResource(value) {
  const resource = String(value || MCP_RESOURCE);
  if (resource !== MCP_RESOURCE) {
    throw new OAuthProtocolError("invalid_target", "The requested resource is not available");
  }
  return resource;
}

export function validateCodeVerifier(value) {
  const verifier = String(value || "");
  if (!CODE_VERIFIER_PATTERN.test(verifier)) {
    throw new OAuthProtocolError("invalid_grant", "A valid PKCE code_verifier is required");
  }
  return verifier;
}

export async function verifyPkce(codeVerifier, expectedChallenge) {
  const verifier = validateCodeVerifier(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return timingSafeEqual(base64Url(new Uint8Array(digest)), expectedChallenge);
}

export function createOpaqueToken(prefix, byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return `${prefix}${base64Url(bytes)}`;
}

export async function hashOpaqueToken(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return base64Url(new Uint8Array(digest));
}

export function appendAuthorizationResult(redirectUri, values) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function authorizationPageCsp(redirectUri) {
  const formActions = ["'self'"];
  if (redirectUri) {
    formActions.push(new URL(validateRedirectUri(redirectUri)).origin);
  }
  return `default-src 'none'; style-src 'unsafe-inline'; form-action ${formActions.join(" ")}; frame-ancestors 'none'; base-uri 'none'`;
}

export function oauthClientResponse(client) {
  return {
    client_id: client.clientId,
    client_id_issued_at: client.createdAt,
    client_name: client.clientName,
    ...(client.clientUri ? { client_uri: client.clientUri } : {}),
    grant_types: client.grantTypes,
    redirect_uris: client.redirectUris,
    response_types: client.responseTypes,
    scope: DEFAULT_OAUTH_SCOPE,
    token_endpoint_auth_method: "none",
  };
}

export function validateRedirectUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthProtocolError("invalid_redirect_uri", "Redirect URIs must be absolute URLs");
  }
  if (url.username || url.password || url.hash) {
    throw new OAuthProtocolError("invalid_redirect_uri", "Redirect URIs cannot contain credentials or fragments");
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new OAuthProtocolError("invalid_redirect_uri", "Redirect URIs must use HTTPS or an HTTP loopback address");
  }
  return url.toString();
}

function arrayOrDefault(value, fallback) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string")) {
    throw new OAuthProtocolError("invalid_client_metadata", "Client metadata arrays must contain strings");
  }
  return [...new Set(value)];
}

function cleanText(value, fallback, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function optionalHttpsUri(value) {
  if (value === undefined || value === null || value === "") return null;
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new OAuthProtocolError("invalid_client_metadata", "client_uri must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new OAuthProtocolError("invalid_client_metadata", "client_uri must be a valid HTTPS URL");
  }
  return url.toString();
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
