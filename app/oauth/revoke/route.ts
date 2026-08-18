import { assertSmallRequest, oauthError, oauthJson, oauthOptions } from "../../../lib/oauth-http";
import { revokeOAuthToken } from "../../../lib/oauth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSmallRequest(request);
    const form = await request.formData();
    const token = form.get("token");
    const clientId = form.get("client_id");
    if (typeof token === "string") {
      await revokeOAuthToken(token, typeof clientId === "string" ? clientId : null);
    }
    return oauthJson({});
  } catch (error) {
    return oauthError(error);
  }
}

export const OPTIONS = oauthOptions;
