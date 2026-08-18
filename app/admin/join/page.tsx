import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "../../../db";
import { adminInvites, admins } from "../../../db/schema";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";
export default async function JoinAdmin({searchParams}:{searchParams:Promise<{token?:string}>}){
  const token=(await searchParams).token||"";const db=await getDb();
  const [invite]=await db.select().from(adminInvites).where(and(eq(adminInvites.token,token),eq(adminInvites.active,1))).limit(1);
  if(!invite)return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Enlace inválido</p><h1>Esta invitación ya no está activa.</h1><p>Pide a un administrador que genere un enlace nuevo.</p><Link className="back-link" href="/">← Volver</Link></section></main>;
  const user=await getChatGPTUser();if(!user)return <main className="auth-shell"><section className="auth-card"><Link className="brand" href="/"><span className="signal-dot"/>Conecta Colombia</Link><p className="eyebrow">Invitación de administrador</p><h1>Únete al equipo.</h1><p>Ingresa con ChatGPT para activar tu acceso al portal de administración.</p><a className="primary-button inline-button" href={chatGPTSignInPath(`/admin/join?token=${token}`)}>Aceptar invitación</a></section></main>;
  const email=user.email.toLowerCase();await db.insert(admins).values({email,name:user.fullName,invitedBy:invite.invitedBy,status:"active"}).onConflictDoUpdate({target:admins.email,set:{name:user.fullName,status:"active"}});redirect("/admin");
}
