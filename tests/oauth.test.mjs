import assert from "node:assert/strict";
import test from "node:test";
import { signOAuthApproval, verifyOAuthApproval } from "../lib/oauth-approval.js";
import {
  DEFAULT_OAUTH_SCOPE,
  MCP_RESOURCE,
  OAUTH_ISSUER,
  OAuthProtocolError,
  authorizationServerMetadata,
  hashOpaqueToken,
  normalizeClientRegistration,
  protectedResourceMetadata,
  validateAuthorizationRequest,
  verifyPkce,
} from "../lib/oauth.js";

const secret = "oauth-test-secret-that-is-longer-than-thirty-two-characters";
const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";

test("OAuth metadata supports MCP discovery, DCR, PKCE, refresh, and revocation", () => {
  assert.deepEqual(protectedResourceMetadata(), {
    authorization_servers: [OAUTH_ISSUER],
    bearer_methods_supported: ["header"],
    resource: MCP_RESOURCE,
    resource_documentation: "https://github.com/casas111/StarlinkColombia.org/blob/main/docs/MCP.md",
    resource_name: "Conecta Colombia Operations MCP",
    scopes_supported: ["data:read", "data:write", "operations:promote"],
  });
  const metadata = authorizationServerMetadata();
  assert.equal(metadata.registration_endpoint, `${OAUTH_ISSUER}/oauth/register`);
  assert.equal(metadata.token_endpoint, `${OAUTH_ISSUER}/oauth/token`);
  assert.equal(metadata.revocation_endpoint, `${OAUTH_ISSUER}/oauth/revoke`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(metadata.grant_types_supported, ["authorization_code", "refresh_token"]);
});

test("dynamic client registration accepts secure and loopback callbacks only", () => {
  const client = normalizeClientRegistration({
    client_name: "Claude Code",
    redirect_uris: ["http://localhost:8765/callback", "https://client.example/callback"],
  });
  assert.equal(client.clientName, "Claude Code");
  assert.deepEqual(client.grantTypes, ["authorization_code", "refresh_token"]);
  assert.throws(
    () => normalizeClientRegistration({ redirect_uris: ["http://client.example/callback"] }),
    (error) => error instanceof OAuthProtocolError && error.code === "invalid_redirect_uri",
  );
  assert.throws(
    () => normalizeClientRegistration({ redirect_uris: ["https://client.example/callback#token"] }),
    /fragments/u,
  );
});

test("authorization requests require a registered callback and S256 PKCE", async () => {
  const challenge = await pkceChallenge(verifier);
  const client = {
    clientId: "client-1",
    redirectUris: ["http://localhost:8765/callback"],
  };
  const params = new URLSearchParams({
    client_id: client.clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: client.redirectUris[0],
    resource: MCP_RESOURCE,
    response_type: "code",
    state: "state-1",
  });
  assert.deepEqual(validateAuthorizationRequest(params, client), {
    clientId: "client-1",
    codeChallenge: challenge,
    redirectUri: "http://localhost:8765/callback",
    resource: MCP_RESOURCE,
    scope: DEFAULT_OAUTH_SCOPE,
    state: "state-1",
  });
  params.set("code_challenge_method", "plain");
  assert.throws(() => validateAuthorizationRequest(params, client), /PKCE/u);
  assert.equal(await verifyPkce(verifier, challenge), true);
  assert.equal(await verifyPkce(`${verifier}x`, challenge), false);
});

test("opaque token hashes are deterministic without exposing the credential", async () => {
  assert.equal(await hashOpaqueToken("token-one"), await hashOpaqueToken("token-one"));
  assert.notEqual(await hashOpaqueToken("token-one"), await hashOpaqueToken("token-two"));
  assert.equal((await hashOpaqueToken("token-one")).includes("token-one"), false);
});

test("OAuth consent approvals are signed, expire, and reject tampering", async () => {
  const approval = await signOAuthApproval(
    { adminEmail: "admin@example.com", clientId: "client-1", scope: DEFAULT_OAUTH_SCOPE },
    secret,
    1_000,
  );
  const claims = await verifyOAuthApproval(approval, secret, 1_100);
  assert.equal(claims.adminEmail, "admin@example.com");
  assert.equal(claims.clientId, "client-1");
  await assert.rejects(
    () => verifyOAuthApproval(approval.replace(/^smap1/u, "smcp1"), secret, 1_100),
    /invalid/u,
  );
  await assert.rejects(() => verifyOAuthApproval(`${approval}x`, secret, 1_100), /invalid/u);
  await assert.rejects(() => verifyOAuthApproval(approval, secret, 1_601), /expired/u);
});

async function pkceChallenge(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Buffer.from(digest).toString("base64url");
}
