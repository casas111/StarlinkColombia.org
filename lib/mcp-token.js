const TOKEN_PREFIX = "smcp1";
const TOKEN_AUDIENCE = "starlinkcolombia-admin";

export const MCP_SCOPES = [
  "data:read",
  "data:write",
  "operations:promote",
];

export class McpTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = "McpTokenError";
  }
}

/**
 * Create a compact, HMAC-signed token for one MCP operator.
 *
 * @param {object} input
 * @param {string} input.secret
 * @param {string} input.subject
 * @param {string | undefined} input.name
 * @param {string[]} input.scopes
 * @param {number} input.expiresAt Unix time in seconds.
 * @param {number | undefined} input.issuedAt Unix time in seconds.
 * @param {string | undefined} input.tokenId
 */
export async function signMcpToken({
  secret,
  subject,
  name,
  scopes,
  expiresAt,
  issuedAt = Math.floor(Date.now() / 1000),
  tokenId = crypto.randomUUID(),
}) {
  validateSecret(secret);
  const email = normalizeEmail(subject);
  const cleanScopes = validateScopes(scopes);
  if (!Number.isInteger(expiresAt) || expiresAt <= issuedAt) {
    throw new McpTokenError("Token expiration must be after its issue time");
  }

  const payload = {
    aud: TOKEN_AUDIENCE,
    exp: expiresAt,
    iat: issuedAt,
    jti: tokenId,
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : undefined,
    scopes: cleanScopes,
    sub: email,
  };
  const encodedPayload = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await sign(secret, encodedPayload);
  return `${TOKEN_PREFIX}.${encodedPayload}.${encodeBase64Url(signature)}`;
}

/**
 * Verify and decode an MCP operator token.
 *
 * @param {string} token
 * @param {string} secret
 * @param {number | undefined} now Unix time in seconds.
 */
export async function verifyMcpToken(
  token,
  secret,
  now = Math.floor(Date.now() / 1000),
) {
  validateSecret(secret);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    throw new McpTokenError("Invalid token format");
  }

  let payload;
  try {
    payload = JSON.parse(textDecoder.decode(decodeBase64Url(parts[1])));
  } catch {
    throw new McpTokenError("Invalid token payload");
  }

  let signature;
  try {
    signature = decodeBase64Url(parts[2]);
  } catch {
    throw new McpTokenError("Invalid token signature");
  }

  const key = await importKey(secret, ["verify"]);
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    textEncoder.encode(parts[1]),
  );
  if (!validSignature) throw new McpTokenError("Invalid token signature");

  if (!payload || payload.aud !== TOKEN_AUDIENCE) {
    throw new McpTokenError("Invalid token audience");
  }
  const subject = normalizeEmail(payload.sub);
  const scopes = validateScopes(payload.scopes);
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    throw new McpTokenError("Invalid token timestamps");
  }
  if (payload.iat > now + 300) throw new McpTokenError("Token is not active yet");
  if (payload.exp <= now) throw new McpTokenError("Token has expired");
  if (typeof payload.jti !== "string" || !payload.jti.trim()) {
    throw new McpTokenError("Invalid token identifier");
  }

  return {
    expiresAt: payload.exp,
    issuedAt: payload.iat,
    name:
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim().slice(0, 200)
        : undefined,
    scopes,
    subject,
    tokenId: payload.jti,
  };
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function sign(secret, value) {
  const key = await importKey(secret, ["sign"]);
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)),
  );
}

async function importKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    usages,
  );
}

function validateSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new McpTokenError("MCP_AUTH_SECRET must contain at least 32 characters");
  }
}

function normalizeEmail(value) {
  if (typeof value !== "string") throw new McpTokenError("Invalid token subject");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new McpTokenError("Invalid token subject");
  }
  return email;
}

function validateScopes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new McpTokenError("At least one MCP scope is required");
  }
  const scopes = [...new Set(value)];
  if (scopes.some((scope) => !MCP_SCOPES.includes(scope))) {
    throw new McpTokenError("Token contains an unsupported MCP scope");
  }
  return scopes;
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid base64url");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
