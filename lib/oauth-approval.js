import { OAuthProtocolError } from "./oauth.js";

const PREFIX = "smap1";

export async function signOAuthApproval(claims, secret, now = Math.floor(Date.now() / 1000)) {
  validateSecret(secret);
  const payload = {
    ...claims,
    exp: now + 10 * 60,
    iat: now,
    nonce: crypto.randomUUID(),
  };
  const encoded = encode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${PREFIX}.${encoded}.${encode(await signature(secret, `${PREFIX}.${encoded}`))}`;
}

export async function verifyOAuthApproval(token, secret, now = Math.floor(Date.now() / 1000)) {
  validateSecret(secret);
  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    throw new OAuthProtocolError("invalid_request", "The authorization approval is invalid");
  }
  let supplied;
  try {
    supplied = decode(parts[2]);
  } catch {
    throw new OAuthProtocolError("invalid_request", "The authorization approval is invalid");
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    await key(secret, ["verify"]),
    supplied,
    new TextEncoder().encode(`${PREFIX}.${parts[1]}`),
  );
  if (!valid) throw new OAuthProtocolError("invalid_request", "The authorization approval is invalid");
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  } catch {
    throw new OAuthProtocolError("invalid_request", "The authorization approval is invalid");
  }
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.iat > now + 300 || payload.exp <= now) {
    throw new OAuthProtocolError("invalid_request", "The authorization approval has expired");
  }
  return payload;
}

async function signature(secret, value) {
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), new TextEncoder().encode(value)),
  );
}

function key(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    usages,
  );
}

function validateSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new OAuthProtocolError("server_error", "OAuth authorization is not configured", 503);
  }
}

function encode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid base64url");
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
