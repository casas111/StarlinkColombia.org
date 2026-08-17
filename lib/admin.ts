import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { admins } from "../db/schema";
import { getChatGPTUser } from "../app/chatgpt-auth";

export const OWNER_EMAIL = "a.casas402@gmail.com";

export async function getAuthorizedAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.toLowerCase();
  const db = await getDb();
  if (email === OWNER_EMAIL) {
    await db.insert(admins).values({ email, name: user.fullName ?? "Alejandro Casas", status: "active" }).onConflictDoUpdate({ target: admins.email, set: { name: user.fullName ?? "Alejandro Casas", status: "active" } });
    return { ...user, email };
  }
  const [record] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (!record) return null;
  if (record.status !== "active") await db.update(admins).set({ status: "active", name: user.fullName ?? record.name }).where(eq(admins.email, email));
  return { ...user, email };
}
