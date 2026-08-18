"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type FormState = {
  organization: string; organizationType: string; department: string; city: string;
  location: string; units: string; useCase: string; impact: string;
  responsibleName: string; responsibleRole: string; phone: string; email: string;
  powerAvailable: string; safeInstallation: string; continuityPlan: string;
  deliveryTiming: string; requestedDeliveryAt: string;
};

const initialForm: FormState = {
  organization: "", organizationType: "", department: "", city: "", location: "",
  units: "1", useCase: "", impact: "", responsibleName: "", responsibleRole: "",
  phone: "", email: "", powerAvailable: "", safeInstallation: "", continuityPlan: "",
  deliveryTiming: "", requestedDeliveryAt: "",
};

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [reference, setReference] = useState("");
  const update = (field: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setStatus("sending");
    const response = await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, units: Number(form.units), source: "web" }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus("error");
    setReference(result.reference); setStatus("sent");
  }

  if (status === "sent") return <main className="public-shell"><section className="success-card"><div className="success-mark">✓</div><p className="eyebrow">Solicitud recibida</p><h1>Gracias por ayudarnos a conectar donde más se necesita.</h1><p>El equipo revisará la información y se comunicará con la persona responsable.</p><div className="reference">Referencia <strong>{reference}</strong></div><button className="secondary-button" onClick={() => { setForm(initialForm); setStep(1); setStatus("idle"); }}>Enviar otra solicitud</button></section></main>;

  return <main className="public-shell">
    <header className="topbar"><Link className="brand" href="/" aria-label="Conecta Colombia, inicio"><span className="signal-dot"/><span>Conecta Colombia</span></Link><Link className="admin-link" href="/admin">Administradores</Link></header>
    <section className="hero-grid">
      <div className="hero-copy"><p className="eyebrow">Conectividad para la respuesta humanitaria</p><h1>Solicita una antena Starlink para tu comunidad.</h1><p className="lede">Buscamos lugares donde la conectividad pueda responder a una necesidad urgente y seguir generando valor después de la crisis.</p><div className="principles"><div><span>01</span><p><strong>Necesidad clara</strong>Cuéntanos qué operación crítica necesita conectividad.</p></div><div><span>02</span><p><strong>Responsable local</strong>Una persona debe recibir, custodiar y acompañar la instalación.</p></div><div><span>03</span><p><strong>Impacto sostenible</strong>Priorizamos usos que puedan continuar después de la emergencia.</p></div></div></div>
      <form className="application-card" onSubmit={submit}>
        <div className="form-head"><div><p className="eyebrow">Aplicación breve</p><h2>{step === 1 ? "La necesidad" : step === 2 ? "El lugar" : "La persona responsable"}</h2></div><span className="step-pill">{step} de 3</span></div><div className="progress"><span style={{width:`${step*33.34}%`}}/></div>
        {step===1&&<div className="fields"><label>Organización o comunidad<input required value={form.organization} onChange={e=>update("organization",e.target.value)} placeholder="Ej. Hospital, Cruz Roja, colectivo comunitario"/></label><label>Tipo de organización<select required value={form.organizationType} onChange={e=>update("organizationType",e.target.value)}><option value="">Selecciona una opción</option><option>Salud</option><option>Respuesta humanitaria</option><option>Gobierno local</option><option>Seguridad y rescate</option><option>Educación</option><option>Comunidad</option><option>Otra</option></select></label><label className="wide">¿Para qué necesitan la conectividad?<textarea required minLength={80} maxLength={1200} value={form.useCase} onChange={e=>update("useCase",e.target.value)} placeholder="Describe la operación, quiénes se benefician y cómo se utilizaría la antena. Entre más concreto, mejor."/><small>{form.useCase.length}/1200 · mínimo 80 caracteres</small></label><label className="wide">¿Qué pasaría si no tienen conectividad?<textarea required minLength={30} maxLength={500} value={form.impact} onChange={e=>update("impact",e.target.value)} placeholder="Describe la urgencia y el impacto operativo o humano."/></label></div>}
        {step===2&&<div className="fields two-col"><label>Departamento<input required value={form.department} onChange={e=>update("department",e.target.value)} placeholder="Ej. Chocó"/></label><label>Municipio o ciudad<input required value={form.city} onChange={e=>update("city",e.target.value)} placeholder="Ej. Quibdó"/></label><label className="wide">Lugar exacto de instalación<input required value={form.location} onChange={e=>update("location",e.target.value)} placeholder="Nombre del sitio, barrio, vereda o dirección"/></label><label>Unidades solicitadas<input required type="number" min="1" max="20" value={form.units} onChange={e=>update("units",e.target.value)}/></label><label>Fecha de entrega de la antena<select required value={form.deliveryTiming} onChange={e=>{update("deliveryTiming",e.target.value);if(e.target.value!=="scheduled")update("requestedDeliveryAt","")}}><option value="">Selecciona</option><option value="asap">Lo más pronto posible</option><option value="scheduled">Escoger fecha y hora</option></select></label>{form.deliveryTiming==="scheduled"&&<label className="wide delivery-date">Día y hora de entrega<input required type="datetime-local" min={new Date().toISOString().slice(0,16)} value={form.requestedDeliveryAt} onChange={e=>update("requestedDeliveryAt",e.target.value)}/><small>Indica la fecha y hora local del lugar de entrega.</small></label>}<label>¿Hay energía eléctrica estable?<select required value={form.powerAvailable} onChange={e=>update("powerAvailable",e.target.value)}><option value="">Selecciona</option><option value="yes">Sí</option><option value="partial">Parcial / con planta o batería</option><option value="no">No</option></select></label><label>¿Existe un lugar seguro y con cielo abierto?<select required value={form.safeInstallation} onChange={e=>update("safeInstallation",e.target.value)}><option value="">Selecciona</option><option value="yes">Sí</option><option value="to_confirm">Por confirmar</option><option value="no">No</option></select></label><label>¿Podría seguir operando después de la crisis?<select required value={form.continuityPlan} onChange={e=>update("continuityPlan",e.target.value)}><option value="">Selecciona</option><option value="yes">Sí, podemos sostener la operación</option><option value="support">Sí, con apoyo para la suscripción</option><option value="no">No está definido</option></select></label></div>}
        {step===3&&<div className="fields two-col"><label>Nombre completo<input required value={form.responsibleName} onChange={e=>update("responsibleName",e.target.value)}/></label><label>Cargo o relación con la organización<input required value={form.responsibleRole} onChange={e=>update("responsibleRole",e.target.value)}/></label><label>WhatsApp<input required type="tel" value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+57 300 000 0000"/></label><label>Correo electrónico<input required type="email" value={form.email} onChange={e=>update("email",e.target.value)} placeholder="nombre@organizacion.org"/></label><label className="wide consent"><input required type="checkbox"/><span>Confirmo que la información es correcta y que la persona responsable puede recibir, custodiar y acompañar la instalación.</span></label></div>}
        {status==="error"&&<p className="error-message">No pudimos enviar la solicitud. Revisa los campos e inténtalo nuevamente.</p>}
        <div className="form-actions">{step>1&&<button type="button" className="ghost-button" onClick={()=>setStep(step-1)}>Atrás</button>}{step<3?<button type="button" className="primary-button" onClick={()=>{const el=document.querySelector("form") as HTMLFormElement;if(el.reportValidity())setStep(step+1)}}>Continuar</button>:<button disabled={status==="sending"} className="primary-button" type="submit">{status==="sending"?"Enviando…":"Enviar solicitud"}</button>}</div><p className="privacy-note">Usaremos estos datos únicamente para evaluar, coordinar y dar seguimiento a la solicitud.</p>
      </form>
    </section>
    <section className="whatsapp-strip"><div><span className="wa-icon">◉</span><div><strong>¿Prefieres conversar?</strong><p>También podrás aplicar por WhatsApp con el agente de Conecta Colombia.</p></div></div><span className="coming-soon">Canal en activación</span></section>
    <footer><span>Conecta Colombia</span><p>Una iniciativa de coordinación humanitaria para llevar conectividad a donde más se necesita.</p></footer>
  </main>;
}
