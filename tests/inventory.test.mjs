import assert from "node:assert/strict";
import test from "node:test";
import { validateInventoryInput } from "../lib/inventory.mjs";

test("inventory requires a location, handler, and scheduled availability date", () => {
  const missingLocation = validateInventoryInput({ sourceType: "incoming", name: "Lote norte", units: 4, location: "", handlerEmail: "admin@example.com", availabilityStatus: "pending" });
  assert.equal(missingLocation.error, "La ubicación es obligatoria.");

  const missingDate = validateInventoryInput({ sourceType: "recycle", name: "Equipo recuperado", units: 1, location: "Bodega Bogotá", handlerEmail: "admin@example.com", availabilityStatus: "scheduled" });
  assert.equal(missingDate.error, "Indica cuándo estará disponible.");
});

test("inventory normalizes a complete incoming lot", () => {
  const result = validateInventoryInput({ sourceType: "incoming", name: "  Lote agosto  ", units: 12, location: "  Bodega Medellín ", handlerEmail: "ADMIN@EXAMPLE.COM", availabilityStatus: "scheduled", availableAt: "2026-08-25T09:00", notes: "  En tránsito  " });
  assert.deepEqual(result.data, {
    sourceType: "incoming",
    name: "Lote agosto",
    units: 12,
    location: "Bodega Medellín",
    handlerEmail: "admin@example.com",
    availabilityStatus: "scheduled",
    availableAt: "2026-08-25T09:00",
    notes: "En tránsito",
    status: "",
  });
});
