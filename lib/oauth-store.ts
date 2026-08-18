import { and, count, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";
import { getDb } from "../db";
import { oauthAuthorizationCodes, oauthClients, oauthTokens } from "../db/schema";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  MCP_RESOURCE,
  OAuthProtocolError,
  REFRESH_TOKEN_TTL_SECONDS,
  createOpaqueToken,
  hashOpaqueToken,
  normalizeScope,
  verifyPkce,
} from "./oauth.js";

type ClientRegistration = {
  clientName: string;
  clientUri: string | null;
  grantTypes: string[];
  redirectUris: string[];
  responseTypes: string[];
};

export type OAuthClient = ClientRegistration & {
  clientId: string;
  createdAt: number;
};

type AuthorizationCodeInput = {
  adminEmail: string;
  adminName: string | null;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  resource: string;
  scope: string;
};

export async function registerOAuthClient(
  metadata: ClientRegistration,
  registrationKey: string,
): Promise<OAuthClient> {
  const db = await getDb();
  const now = epoch();
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(oauthClients)
    .where(and(eq(oauthClients.registrationKey, registrationKey), gt(oauthClients.createdAt, now - 600)));
  if (recent >= 10) {
    throw new OAuthProtocolError("temporarily_unavailable", "Too many recent client registrations", 429);
  }
  const client: OAuthClient = {
    ...metadata,
    clientId: `smcp_client_${crypto.randomUUID().replaceAll("-", "")}`,
    createdAt: now,
  };
  await db.insert(oauthClients).values({
    clientId: client.clientId,
    clientName: client.clientName,
    clientUri: client.clientUri,
    createdAt: client.createdAt,
    grantTypes: JSON.stringify(client.grantTypes),
    redirectUris: JSON.stringify(client.redirectUris),
    registrationKey,
    responseTypes: JSON.stringify(client.responseTypes),
  });
  return client;
}

export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 200) return null;
  const [record] = await (await getDb())
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);
  if (!record) return null;
  try {
    return {
      clientId: record.clientId,
      clientName: record.clientName,
      clientUri: record.clientUri,
      createdAt: record.createdAt,
      grantTypes: JSON.parse(record.grantTypes),
      redirectUris: JSON.parse(record.redirectUris),
      responseTypes: JSON.parse(record.responseTypes),
    };
  } catch {
    return null;
  }
}

export async function createAuthorizationCode(input: AuthorizationCodeInput) {
  const code = createOpaqueToken("smoc1_");
  const now = epoch();
  await (await getDb()).insert(oauthAuthorizationCodes).values({
    codeHash: await hashOpaqueToken(code),
    clientId: input.clientId,
    adminEmail: input.adminEmail.toLowerCase(),
    adminName: input.adminName,
    redirectUri: input.redirectUri,
    scope: input.scope,
    resource: input.resource,
    codeChallenge: input.codeChallenge,
    createdAt: now,
    expiresAt: now + AUTHORIZATION_CODE_TTL_SECONDS,
  });
  return code;
}

export async function exchangeAuthorizationCode(input: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  resource: string;
}) {
  const db = await getDb();
  const now = epoch();
  const codeHash = await hashOpaqueToken(input.code);
  const [record] = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.codeHash, codeHash))
    .limit(1);
  if (
    !record ||
    record.clientId !== input.clientId ||
    record.redirectUri !== input.redirectUri ||
    record.resource !== input.resource ||
    record.expiresAt <= now ||
    record.usedAt !== null
  ) {
    throw new OAuthProtocolError("invalid_grant", "The authorization code is invalid or expired");
  }
  if (!(await verifyPkce(input.codeVerifier, record.codeChallenge))) {
    throw new OAuthProtocolError("invalid_grant", "PKCE verification failed");
  }
  const consumed = await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: now })
    .where(and(eq(oauthAuthorizationCodes.codeHash, codeHash), isNull(oauthAuthorizationCodes.usedAt), gt(oauthAuthorizationCodes.expiresAt, now)))
    .returning({ codeHash: oauthAuthorizationCodes.codeHash });
  if (consumed.length !== 1) {
    throw new OAuthProtocolError("invalid_grant", "The authorization code was already used");
  }
  await db
    .update(oauthClients)
    .set({ lastUsedAt: now })
    .where(eq(oauthClients.clientId, input.clientId));
  return issueTokenPair({
    adminEmail: record.adminEmail,
    adminName: record.adminName,
    clientId: record.clientId,
    resource: record.resource,
    scope: record.scope,
  });
}

export async function refreshOAuthToken(input: {
  clientId: string;
  refreshToken: string;
  resource: string;
  requestedScope?: string | null;
}) {
  const db = await getDb();
  const now = epoch();
  const tokenHash = await hashOpaqueToken(input.refreshToken);
  const [record] = await db.select().from(oauthTokens).where(eq(oauthTokens.tokenHash, tokenHash)).limit(1);
  if (!record || record.tokenType !== "refresh" || record.clientId !== input.clientId || record.resource !== input.resource) {
    throw new OAuthProtocolError("invalid_grant", "The refresh token is invalid");
  }
  if (record.consumedAt !== null || record.revokedAt !== null) {
    await db.update(oauthTokens).set({ revokedAt: now }).where(eq(oauthTokens.familyId, record.familyId));
    throw new OAuthProtocolError("invalid_grant", "Refresh token reuse was detected");
  }
  if (record.expiresAt <= now) {
    throw new OAuthProtocolError("invalid_grant", "The refresh token has expired");
  }
  const scope = input.requestedScope ? normalizeScope(input.requestedScope, record.scope) : record.scope;
  const consumed = await db
    .update(oauthTokens)
    .set({ consumedAt: now })
    .where(and(eq(oauthTokens.tokenHash, tokenHash), isNull(oauthTokens.consumedAt), isNull(oauthTokens.revokedAt), gt(oauthTokens.expiresAt, now)))
    .returning({ id: oauthTokens.id });
  if (consumed.length !== 1) {
    await db.update(oauthTokens).set({ revokedAt: now }).where(eq(oauthTokens.familyId, record.familyId));
    throw new OAuthProtocolError("invalid_grant", "Refresh token reuse was detected");
  }
  return issueTokenPair({
    adminEmail: record.adminEmail,
    adminName: record.adminName,
    clientId: record.clientId,
    familyId: record.familyId,
    resource: record.resource,
    scope,
  });
}

export async function resolveOAuthAccessToken(token: string) {
  if (!token.startsWith("smoa1_") || token.length > 200) return null;
  const now = epoch();
  const [record] = await (await getDb())
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.tokenHash, await hashOpaqueToken(token)))
    .limit(1);
  if (
    !record ||
    record.tokenType !== "access" ||
    record.resource !== MCP_RESOURCE ||
    record.expiresAt <= now ||
    record.revokedAt !== null
  ) {
    return null;
  }
  return {
    name: record.adminName ?? undefined,
    scopes: record.scope.split(" ").filter(Boolean),
    subject: record.adminEmail,
    tokenId: record.id,
  };
}

export async function revokeOAuthToken(token: string, clientId?: string | null) {
  if (!token || token.length > 500) return;
  const db = await getDb();
  const [record] = await db
    .select()
    .from(oauthTokens)
    .where(eq(oauthTokens.tokenHash, await hashOpaqueToken(token)))
    .limit(1);
  if (!record || (clientId && record.clientId !== clientId)) return;
  const now = epoch();
  await db.update(oauthTokens).set({ revokedAt: now }).where(eq(oauthTokens.familyId, record.familyId));
}

export async function cleanupExpiredOAuthState() {
  const db = await getDb();
  const now = epoch();
  await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, now - 24 * 60 * 60));
  await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now - 30 * 24 * 60 * 60));
}

async function issueTokenPair(input: {
  adminEmail: string;
  adminName: string | null;
  clientId: string;
  familyId?: string;
  resource: string;
  scope: string;
}) {
  const accessToken = createOpaqueToken("smoa1_");
  const refreshToken = createOpaqueToken("smor1_", 48);
  const now = epoch();
  const familyId = input.familyId ?? crypto.randomUUID();
  const accessId = crypto.randomUUID();
  const refreshId = crypto.randomUUID();
  await (await getDb()).insert(oauthTokens).values([
    {
      id: accessId,
      tokenHash: await hashOpaqueToken(accessToken),
      tokenType: "access",
      familyId,
      clientId: input.clientId,
      adminEmail: input.adminEmail,
      adminName: input.adminName,
      scope: input.scope,
      resource: input.resource,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
      createdAt: now,
    },
    {
      id: refreshId,
      tokenHash: await hashOpaqueToken(refreshToken),
      tokenType: "refresh",
      familyId,
      clientId: input.clientId,
      adminEmail: input.adminEmail,
      adminName: input.adminName,
      scope: input.scope,
      resource: input.resource,
      expiresAt: now + REFRESH_TOKEN_TTL_SECONDS,
      createdAt: now,
    },
  ]);
  if (input.familyId) {
    const db = await getDb();
    const [revoked] = await db
      .select({ id: oauthTokens.id })
      .from(oauthTokens)
      .where(and(eq(oauthTokens.familyId, familyId), isNotNull(oauthTokens.revokedAt)))
      .limit(1);
    if (revoked) {
      await db.update(oauthTokens).set({ revokedAt: now }).where(eq(oauthTokens.familyId, familyId));
      throw new OAuthProtocolError("invalid_grant", "The refresh token family was revoked");
    }
  }
  return {
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    scope: input.scope,
    tokenType: "Bearer",
  };
}

function epoch() {
  return Math.floor(Date.now() / 1000);
}
