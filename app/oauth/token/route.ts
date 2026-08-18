import { OAuthProtocolError, normalizeResource } from "../../../lib/oauth.js";
import { assertSmallRequest, oauthError, oauthJson, oauthOptions } from "../../../lib/oauth-http";
import { exchangeAuthorizationCode, getOAuthClient, refreshOAuthToken } from "../../../lib/oauth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSmallRequest(request);
    if (request.headers.has("authorization")) {
      throw new OAuthProtocolError("invalid_client", "Client authentication is not supported", 401);
    }
    const form = await request.formData();
    const clientId = field(form, "client_id", 200);
    if (!clientId || !(await getOAuthClient(clientId))) {
      throw new OAuthProtocolError("invalid_client", "Unknown OAuth client", 401);
    }
    const grantType = field(form, "grant_type", 100);
    const resource = normalizeResource(field(form, "resource", 500));
    const tokens = grantType === "authorization_code"
      ? await exchangeAuthorizationCode({
          clientId,
          code: field(form, "code", 500),
          codeVerifier: field(form, "code_verifier", 200),
          redirectUri: field(form, "redirect_uri", 2000),
          resource,
        })
      : grantType === "refresh_token"
        ? await refreshOAuthToken({
            clientId,
            refreshToken: field(form, "refresh_token", 500),
            requestedScope: optionalField(form, "scope", 500),
            resource,
          })
        : (() => { throw new OAuthProtocolError("unsupported_grant_type", "Unsupported OAuth grant type"); })();
    return oauthJson({
      access_token: tokens.accessToken,
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      token_type: tokens.tokenType,
    });
  } catch (error) {
    return oauthError(error);
  }
}

export const OPTIONS = oauthOptions;

function field(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  if (typeof value !== "string" || !value || value.length > maxLength) {
    throw new OAuthProtocolError("invalid_request", `${key} is required`);
  }
  return value;
}

function optionalField(form: FormData, key: string, maxLength: number) {
  const value = form.get(key);
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new OAuthProtocolError("invalid_request", `${key} is invalid`);
  }
  return value;
}
