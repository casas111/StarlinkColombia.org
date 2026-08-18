"use client";

import { useState, type FormEvent } from "react";

export type InventoryItem = {
  id: number;
  sourceType: "recycle" | "incoming";
  sourceEntityType: "application" | "allocation" | null;
  sourceEntityId: number | null;
  name: string;
  units: number;
  location: string;
  handlerEmail: string;
  handlerName: string;
  availabilityStatus: "pending" | "scheduled" | "available";
  availableAt: string | null;
  notes: string;
  status: "active" | "reserved" | "archived";
  updatedAt: string;
};

type Admin = { email: string; name: string | null; status: string };
type Message = { tone: "success" | "error"; text: string } | null;

const availabilityLabels = {
  available: "Disponible ahora",
  scheduled: "Disponibilidad programada",
  pending: "Fecha por confirmar",
};

export default function InventoryPanel({ items, admins, onChanged }: { items: InventoryItem[]; admins: Admin[]; onChanged: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const activeAdmins = admins.filter((item) => item.status === "active");
  const visible = items.filter((item) => item.status !== "archived");
  const archived = items.filter((item) => item.status === "archived");
  const availableUnits = visible.filter((item) => item.status === "active" && item.availabilityStatus === "available").reduce((sum, item) => sum + item.units, 0);
  const expectedUnits = visible.filter((item) => item.status === "active" && item.availabilityStatus !== "available").reduce((sum, item) => sum + item.units, 0);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    setCreating(true); setMessage(null);
    const response = await fetch("/api/admin/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, units: Number(payload.units) }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { form.reset(); setMessage({ tone: "success", text: "Inventario registrado correctamente." }); await onChanged(); }
    else setMessage({ tone: "error", text: result.error || "No fue posible registrar el inventario." });
    setCreating(false);
  }

  return <section className="inventory-page">
    <div className="inventory-overview">
      <div><p className="eyebrow">Control de disponibilidad</p><h2>Inventario disponible</h2><p>Ubicación, responsable y fecha de disponibilidad para equipos recuperados o nuevos.</p></div>
      <div className="inventory-kpis"><span><strong>{availableUnits}</strong> unidades disponibles</span><span><strong>{expectedUnits}</strong> por llegar o preparar</span><span><strong>{visible.length}</strong> lotes activos</span></div>
    </div>
    <div className="inventory-layout">
      <form className="inventory-create" onSubmit={create}>
        <div><small>Nuevo inventario</small><h3>Registrar equipos</h3><p>Usa este formulario para inventario nuevo en camino o recuperado fuera del embudo.</p></div>
        <label>Origen<select name="sourceType" defaultValue="incoming"><option value="incoming">Inventario nuevo en camino</option><option value="recycle">Recycle · recuperado</option></select></label>
        <label>Nombre o lote<input required name="name" maxLength={250} placeholder="Ej. Lote Bogotá · septiembre"/></label>
        <label>Unidades<input required name="units" type="number" min="1" max="1000" defaultValue="1"/></label>
        <label>Ubicación<input required name="location" maxLength={500} placeholder="Bodega, ciudad, dirección o punto logístico"/></label>
        <label>Quién lo maneja<select required name="handlerEmail" defaultValue=""><option value="">Selecciona un administrador</option>{activeAdmins.map((item) => <option key={item.email} value={item.email}>{item.name || item.email}</option>)}</select></label>
        <label>Disponibilidad<select name="availabilityStatus" defaultValue="pending"><option value="available">Disponible ahora</option><option value="scheduled">Fecha definida</option><option value="pending">Por confirmar</option></select></label>
        <label>Disponible desde<input name="availableAt" type="datetime-local"/><small>Obligatorio cuando eliges “Fecha definida”.</small></label>
        <label>Notas<textarea name="notes" maxLength={1500} placeholder="Condición, seriales, transporte o restricciones"/></label>
        <button disabled={creating} type="submit">{creating ? "Registrando…" : "Registrar inventario"}</button>
        {message && <p className={`inventory-message ${message.tone}`}>{message.text}</p>}
      </form>
      <div className="inventory-board">
        <div className="inventory-board-head"><div><small>Seguimiento</small><h3>Equipos y lotes</h3></div><span>{visible.length} activos</span></div>
        {visible.length ? <div className="inventory-list">{visible.map((item) => <InventoryCard key={item.id} item={item} admins={activeAdmins} onChanged={onChanged}/>)}</div> : <div className="inventory-empty"><strong>No hay inventario registrado.</strong><span>Los equipos que pasen a Recycle aparecerán aquí automáticamente.</span></div>}
        {archived.length > 0 && <details className="inventory-archive"><summary>{archived.length} registros archivados</summary><div className="inventory-list">{archived.map((item) => <InventoryCard key={item.id} item={item} admins={activeAdmins} onChanged={onChanged}/>)}</div></details>}
      </div>
    </div>
  </section>;
}

function InventoryCard({ item, admins, onChanged }: { item: InventoryItem; admins: Admin[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSaving(true); setError("");
    const response = await fetch("/api/admin/inventory", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, ...payload, units: Number(payload.units) }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setEditing(false); await onChanged(); }
    else setError(result.error || "No fue posible guardar los cambios.");
    setSaving(false);
  }

  const date = item.availableAt ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.availableAt)) : "Por confirmar";
  if (editing) return <form className="inventory-card inventory-card-edit" onSubmit={save}>
    <div className="inventory-card-title"><span className={`inventory-source ${item.sourceType}`}>{item.sourceType === "recycle" ? "Recycle" : "Inventario nuevo"}</span><strong>{item.name}</strong></div>
    <label>Nombre o lote<input required name="name" defaultValue={item.name}/></label>
    <label>Unidades<input required name="units" type="number" min="1" max="1000" defaultValue={item.units}/></label>
    <label className="wide">Ubicación<input required name="location" defaultValue={item.location}/></label>
    <label>Responsable<select required name="handlerEmail" defaultValue={item.handlerEmail}>{admins.map((admin) => <option key={admin.email} value={admin.email}>{admin.name || admin.email}</option>)}</select></label>
    <label>Disponibilidad<select name="availabilityStatus" defaultValue={item.availabilityStatus}><option value="available">Disponible ahora</option><option value="scheduled">Fecha definida</option><option value="pending">Por confirmar</option></select></label>
    <label>Disponible desde<input name="availableAt" type="datetime-local" defaultValue={item.availableAt ? item.availableAt.replace("Z", "").slice(0, 16) : ""}/></label>
    <label>Control<select name="status" defaultValue={item.status}><option value="active">Activo</option><option value="reserved">Reservado</option><option value="archived">Archivado</option></select></label>
    <label className="wide">Notas<textarea name="notes" defaultValue={item.notes}/></label>
    {error && <p className="inventory-message error wide">{error}</p>}
    <div className="inventory-edit-actions wide"><button type="button" onClick={() => setEditing(false)}>Cancelar</button><button disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar"}</button></div>
  </form>;

  return <article className={`inventory-card ${item.status}`}>
    <header><div><span className={`inventory-source ${item.sourceType}`}>{item.sourceType === "recycle" ? "Recycle" : "Inventario nuevo"}</span><h4>{item.name}</h4></div><button onClick={() => setEditing(true)}>Editar</button></header>
    <div className="inventory-units"><strong>{item.units}</strong><span>{item.units === 1 ? "unidad" : "unidades"}</span></div>
    <dl><div><dt>Dónde</dt><dd>{item.location}</dd></div><div><dt>Quién lo maneja</dt><dd>{item.handlerName}<small>{item.handlerEmail}</small></dd></div><div><dt>Cuándo</dt><dd>{item.availabilityStatus === "available" ? "Disponible ahora" : date}<small>{availabilityLabels[item.availabilityStatus]}</small></dd></div></dl>
    {item.notes && <p>{item.notes}</p>}
    <div className="inventory-card-footer"><span className={`inventory-availability ${item.availabilityStatus}`}>{availabilityLabels[item.availabilityStatus]}</span>{item.status === "reserved" && <span className="inventory-reserved">Reservado</span>}</div>
  </article>;
}
