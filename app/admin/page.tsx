import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { getAuthorizedAdmin } from "../../lib/admin";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";
export default async function AdminPage(){
  const user=await getChatGPTUser();
  if(!user)return <main className="auth-shell"><section className="auth-card"><a className="brand" href="/"><span className="signal-dot"/>Conecta Colombia</a><p className="eyebrow">Portal protegido</p><h1>Administración de solicitudes</h1><p>Ingresa con la cuenta de ChatGPT asociada a un administrador autorizado.</p><a className="primary-button inline-button" href={chatGPTSignInPath("/admin")}>Ingresar con ChatGPT</a><a className="back-link" href="/">← Volver al formulario</a></section></main>;
  const admin=await getAuthorizedAdmin();
  if(!admin)return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Acceso pendiente</p><h1>Tu correo no está invitado.</h1><p>Solicita a un administrador que agregue <strong>{user.email}</strong> al equipo.</p><a className="back-link" href={chatGPTSignOutPath("/admin")}>Salir y usar otra cuenta</a></section></main>;
  return <AdminDashboard admin={{name:admin.displayName,email:admin.email}} signOutUrl={chatGPTSignOutPath("/")}/>;
}
