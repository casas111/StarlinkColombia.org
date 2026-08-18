import { getDb } from "../db";
import { mcpAuditLogs } from "../db/schema";
import type { AuthorizedAdmin } from "./admin";

type AuditInput = {
  action: string;
  detail?: Record<string, unknown>;
  targetId: string | number;
  targetType: "allocation" | "application";
};

export async function recordMcpAudit(
  actor: AuthorizedAdmin,
  input: AuditInput,
) {
  if (actor.authSource !== "mcp" || !actor.tokenId) return;
  await (await getDb()).insert(mcpAuditLogs).values({
    actorEmail: actor.email,
    tokenId: actor.tokenId,
    action: input.action.slice(0, 100),
    targetType: input.targetType,
    targetId: String(input.targetId).slice(0, 200),
    detail: JSON.stringify(input.detail ?? {}).slice(0, 4000),
  });
}
