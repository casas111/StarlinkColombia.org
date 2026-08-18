import { getAuthorizedAdmin } from "../../../lib/admin";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";
import { OAuthProtocolError, appendAuthorizationResult, validateAuthorizationRequest } from "../../../lib/oauth.js";
import { signOAuthApproval, verifyOAuthApproval } from "../../../lib/oauth-approval.js";
import { assertSmallRequest } from "../../../lib/oauth-http";
import { createAuthorizationCode, getOAuthClient } from "../../../lib/oauth-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const client = await getOAuthClient(url.searchParams.get("client_id") || "");
    const authorization = validateAuthorizationRequest(url.searchParams, client);
    const user = await getChatGPTUser();
    if (!user) {
      const returnTo = `${url.pathname}${url.search}`;
      return Response.redirect(new URL(chatGPTSignInPath(returnTo), url.origin), 302);
    }
    const admin = await getAuthorizedAdmin();
    if (!admin) return htmlPage(accessDeniedPage(user.email), 403);
    const approval = await signOAuthApproval(
      {
        ...authorization,
        adminEmail: admin.email,
        adminName: admin.fullName,
      },
      process.env.MCP_AUTH_SECRET,
    );
    return htmlPage(consentPage({
      admin,
      approval,
      client: client!,
      redirectUri: authorization.redirectUri,
      scope: authorization.scope,
    }));
  } catch (error) {
    return authorizationError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSmallRequest(request);
    const form = await request.formData();
    const approval = form.get("approval");
    const decision = form.get("decision");
    if (typeof approval !== "string" || !["approve", "deny"].includes(String(decision))) {
      throw new OAuthProtocolError("invalid_request", "The authorization decision is invalid");
    }
    const claims = await verifyOAuthApproval(approval, process.env.MCP_AUTH_SECRET);
    const admin = await getAuthorizedAdmin();
    if (!admin || admin.email !== claims.adminEmail) {
      throw new OAuthProtocolError("access_denied", "The administrator session is no longer active", 403);
    }
    const client = await getOAuthClient(String(claims.clientId || ""));
    const params = new URLSearchParams({
      client_id: String(claims.clientId || ""),
      code_challenge: String(claims.codeChallenge || ""),
      code_challenge_method: "S256",
      redirect_uri: String(claims.redirectUri || ""),
      resource: String(claims.resource || ""),
      response_type: "code",
      scope: String(claims.scope || ""),
      state: String(claims.state || ""),
    });
    const authorization = validateAuthorizationRequest(params, client);
    if (decision === "deny") {
      return Response.redirect(
        appendAuthorizationResult(authorization.redirectUri, {
          error: "access_denied",
          error_description: "The administrator declined access",
          state: authorization.state,
        }),
        303,
      );
    }
    const code = await createAuthorizationCode({
      ...authorization,
      adminEmail: admin.email,
      adminName: admin.fullName,
    });
    return Response.redirect(
      appendAuthorizationResult(authorization.redirectUri, { code, state: authorization.state }),
      303,
    );
  } catch (error) {
    return authorizationError(error);
  }
}

function consentPage({ admin, approval, client, redirectUri, scope }: {
  admin: Awaited<ReturnType<typeof getAuthorizedAdmin>> & {};
  approval: string;
  client: NonNullable<Awaited<ReturnType<typeof getOAuthClient>>>;
  redirectUri: string;
  scope: string;
}) {
  const redirectHost = new URL(redirectUri).host;
  const permissions = permissionItems(scope);
  return pageShell(`
    <main class="card">
      <div class="brand"><span></span>Conecta Colombia</div>
      <p class="eyebrow">Autorización MCP</p>
      <h1>Conectar ${escapeHtml(client.clientName)}</h1>
      <p class="lead">${escapeHtml(client.clientName)} solicita operar el portal de solicitudes de Conecta Colombia en nombre de <strong>${escapeHtml(admin.email)}</strong>.</p>
      <section>
        <h2>Permisos solicitados</h2>
        <ul>${permissions}</ul>
      </section>
      <p class="destination">Al continuar volverás a <strong>${escapeHtml(redirectHost)}</strong>. Solo autoriza si tú iniciaste esta conexión.</p>
      ${independenceNotice()}
      <form method="post" action="/oauth/authorize">
        <input type="hidden" name="approval" value="${escapeHtml(approval)}">
        <button class="approve" type="submit" name="decision" value="approve">Autorizar conexión</button>
        <button class="deny" type="submit" name="decision" value="deny">Cancelar</button>
      </form>
      <small>Los tokens quedan ligados a este MCP, caducan y pueden revocarse.</small>
    </main>
  `);
}

function accessDeniedPage(email: string) {
  return pageShell(`
    <main class="card">
      <div class="brand"><span></span>Conecta Colombia</div>
      <p class="eyebrow">Acceso restringido</p>
      <h1>Esta cuenta no está activa.</h1>
      <p class="lead">${escapeHtml(email)} debe figurar como administrador activo antes de conectar el MCP.</p>
      ${independenceNotice()}
    </main>
  `);
}

function authorizationError(error: unknown) {
  const message = error instanceof OAuthProtocolError ? error.message : "No fue posible completar la autorización.";
  const status = error instanceof OAuthProtocolError ? error.status : 500;
  if (!(error instanceof OAuthProtocolError)) console.error("OAuth authorization failed", error);
  return htmlPage(pageShell(`
    <main class="card">
      <div class="brand"><span></span>Conecta Colombia</div>
      <p class="eyebrow">Autorización MCP</p>
      <h1>No pudimos continuar.</h1>
      <p class="lead">${escapeHtml(message)}</p>
      <p class="destination">Regresa al cliente MCP e inicia nuevamente la conexión.</p>
      ${independenceNotice()}
    </main>
  `), status);
}

function pageShell(content: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar MCP · Conecta Colombia</title><style>
  :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef2ed;color:#15271d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#f9fbf8 0,#e9efea 68%)}.card{width:min(100%,560px);background:white;border:1px solid #dce5dd;border-radius:24px;padding:34px;box-shadow:0 24px 70px rgba(21,39,29,.12)}.brand{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:850}.brand span{width:11px;height:11px;border-radius:50%;background:#2d8758;box-shadow:0 0 0 6px #e0f0e6}.eyebrow{margin:35px 0 8px;color:#2d8758;font-size:11px;font-weight:850;letter-spacing:.11em;text-transform:uppercase}h1{font-size:32px;line-height:1.1;margin:0 0 14px;letter-spacing:-.035em}.lead{color:#506158;line-height:1.6;margin:0 0 24px}section{border:1px solid #e0e8e1;border-radius:16px;padding:18px 20px;background:#fafcf9}h2{font-size:13px;margin:0 0 12px}ul{display:grid;gap:9px;margin:0;padding-left:20px;color:#45564d;font-size:13px;line-height:1.45}.destination{font-size:12px;line-height:1.5;color:#65746c;margin:17px 0}form{display:grid;grid-template-columns:1fr auto;gap:10px}button{border:0;border-radius:11px;padding:13px 18px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.approve{background:#17663f;color:white}.deny{background:#edf1ed;color:#34473c}small{display:block;color:#78867e;font-size:10px;line-height:1.45;margin-top:18px}@media(max-width:520px){.card{padding:26px 22px;border-radius:18px}h1{font-size:27px}form{grid-template-columns:1fr}.deny{order:2}}
  .independence{margin:16px 0;padding:12px 14px;border-radius:12px;background:#f4f6f2;color:#66746c;font-size:11px;line-height:1.5;border:1px solid #e1e6df}
  </style></head><body>${content}</body></html>`;
}

function independenceNotice() {
  return `<p class="independence">Conecta Colombia es una iniciativa independiente de coordinación humanitaria. No está afiliada, patrocinada ni operada por Starlink o SpaceX.</p>`;
}

function htmlPage(body: string, status = 200) {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
    status,
  });
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function permissionItems(scope: string) {
  const descriptions: Record<string, string> = {
    "data:read": "<b>Consultar</b> solicitudes y asignaciones.",
    "data:write": "<b>Actualizar</b> estados, notas y responsables.",
    "operations:promote": "<b>Promover</b> solicitudes a operaciones con confirmación explícita.",
  };
  return scope.split(" ").filter((value) => descriptions[value]).map((value) => `<li>${descriptions[value]}</li>`).join("");
}
