export const INVENTORY_SOURCE_TYPES = ["recycle", "incoming"];
export const INVENTORY_AVAILABILITY_STATUSES = ["pending", "scheduled", "available"];
export const INVENTORY_STATUSES = ["active", "reserved", "archived"];

export function validateInventoryInput(input, { partial = false } = {}) {
  const sourceType = clean(input?.sourceType, 30);
  const name = clean(input?.name, 250);
  const location = clean(input?.location, 500);
  const handlerEmail = clean(input?.handlerEmail, 250).toLowerCase();
  const availabilityStatus = clean(input?.availabilityStatus, 30);
  const availableAt = clean(input?.availableAt, 50) || null;
  const notes = clean(input?.notes, 1500);
  const status = clean(input?.status, 30);
  const units = Number(input?.units);

  if (!partial || "sourceType" in (input || {})) {
    if (!INVENTORY_SOURCE_TYPES.includes(sourceType)) return invalid("Origen de inventario inválido.");
  }
  if (!partial || "name" in (input || {})) {
    if (!name) return invalid("El nombre o lote es obligatorio.");
  }
  if (!partial || "units" in (input || {})) {
    if (!Number.isInteger(units) || units < 1 || units > 1000) return invalid("Las unidades deben estar entre 1 y 1000.");
  }
  if (!partial || "location" in (input || {})) {
    if (!location) return invalid("La ubicación es obligatoria.");
  }
  if (!partial || "handlerEmail" in (input || {})) {
    if (!handlerEmail) return invalid("Selecciona quién maneja el inventario.");
  }
  if (!partial || "availabilityStatus" in (input || {})) {
    if (!INVENTORY_AVAILABILITY_STATUSES.includes(availabilityStatus)) return invalid("Disponibilidad inválida.");
    if (availabilityStatus === "scheduled" && !availableAt && (!partial || "availableAt" in (input || {}))) return invalid("Indica cuándo estará disponible.");
  }
  if ("status" in (input || {}) && !INVENTORY_STATUSES.includes(status)) return invalid("Estado de inventario inválido.");

  const data = {};
  for (const [key, value] of Object.entries({ sourceType, name, units, location, handlerEmail, availabilityStatus, availableAt, notes, status })) {
    if (!partial || key in (input || {})) data[key] = value;
  }
  if (data.availabilityStatus && data.availabilityStatus !== "scheduled") data.availableAt = null;
  return { data };
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function invalid(error) {
  return { error, status: 400 };
}
