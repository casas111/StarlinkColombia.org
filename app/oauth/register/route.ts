import { OAuthProtocolError, hashOpaqueToken, normalizeClientRegistration, oauthClientResponse } from "../../../lib/oauth.js";
import { assertSmallRequest, oauthError, oauthJson, oauthOptions } from "../../../lib/oauth-http";
import { cleanupExpiredOAuthState, registerOAuthClient } from "../../../lib/oauth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSmallRequest(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new OAuthProtocolError(
        "invalid_client_metadata",
        "A valid JSON client registration is required",
      );
    }
    const metadata = normalizeClientRegistration(body);
    const registrationKey = await hashOpaqueToken(
      `${request.headers.get("cf-connecting-ip") || "unknown"}|${request.headers.get("user-agent") || "unknown"}`,
    );
    await cleanupExpiredOAuthState();
    const client = await registerOAuthClient(metadata, registrationKey);
    return oauthJson(oauthClientResponse(client), 201);
  } catch (error) {
    return oauthError(error);
  }
}

export const OPTIONS = oauthOptions;
