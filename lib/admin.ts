import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { admins } from "../db/schema";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { verifyMcpToken } from "./mcp-token";

export const OWNER_EMAIL = "a.casas402@gmail.com";
export type McpScope = "data:read" | "data:write" | "operations:promote";
export type AuthorizedAdmin = {
  authSource: "chatgpt" | "mcp";
  displayName: string;
  email: string;
  fullName: string | null;
  tokenId: string | null;
};

export async function getAuthorizedAdmin(
  request?: Request,
  requiredScope?: McpScope,
): Promise<AuthorizedAdmin | null> {
  const authorization = request?.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return getAuthorizedMcpAdmin(authorization.slice(7), requiredScope);
  }

  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.toLowerCase();
  const db = await getDb();
  if (email === OWNER_EMAIL) {
    await db.insert(admins).values({ email, name: user.fullName ?? "Alejandro Casas", status: "active" }).onConflictDoUpdate({ target: admins.email, set: { name: user.fullName ?? "Alejandro Casas", status: "active" } });
    return { ...user, authSource: "chatgpt", email, tokenId: null };
  }
  const [record] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (!record || record.status !== "active") return null;
  return { ...user, authSource: "chatgpt", email, tokenId: null };
}

async function getAuthorizedMcpAdmin(
  token: string,
  requiredScope?: McpScope,
): Promise<AuthorizedAdmin | null> {
  const secret = process.env.MCP_AUTH_SECRET;
  if (!secret) return null;

  try {
    const claims = await verifyMcpToken(token, secret);
    if (requiredScope && !claims.scopes.includes(requiredScope)) return null;

    const db = await getDb();
    if (claims.subject !== OWNER_EMAIL) {
      const [record] = await db
        .select()
        .from(admins)
        .where(eq(admins.email, claims.subject))
        .limit(1);
      if (!record || record.status !== "active") return null;
      const fullName = claims.name ?? record.name;
      return {
        authSource: "mcp",
        displayName: fullName ?? claims.subject,
        email: claims.subject,
        fullName,
        tokenId: claims.tokenId,
      };
    }

    return {
      authSource: "mcp",
      displayName: claims.name ?? claims.subject,
      email: claims.subject,
      fullName: claims.name ?? null,
      tokenId: claims.tokenId,
    };
  } catch {
    return null;
  }
}
