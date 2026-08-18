export const MAX_EVIDENCE_FILE_COUNT = 10;
export const MAX_EVIDENCE_FILE_SIZE = 12 * 1024 * 1024;
export const MAX_EVIDENCE_TOTAL_SIZE = 50 * 1024 * 1024;

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);

export function validateEvidenceFiles(values) {
  const files = values.filter((value) => value instanceof File && value.size > 0);
  if (!files.length) return invalid("Debes seleccionar al menos un archivo.", 400);
  if (files.length > MAX_EVIDENCE_FILE_COUNT) {
    return invalid(`Puedes cargar máximo ${MAX_EVIDENCE_FILE_COUNT} archivos a la vez.`, 400);
  }

  const oversized = files.find((file) => file.size > MAX_EVIDENCE_FILE_SIZE);
  if (oversized) return invalid(`${oversized.name} supera el máximo de 12 MB.`, 413);

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > MAX_EVIDENCE_TOTAL_SIZE) {
    return invalid("La selección completa supera el máximo de 50 MB.", 413);
  }

  const unsupported = files.find(
    (file) => !file.type.startsWith("image/") && !allowedTypes.has(file.type),
  );
  if (unsupported) return invalid(`Formato no permitido: ${unsupported.name}.`, 415);

  return { files };
}

export function safeEvidenceFileName(name) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^a-zA-Z0-9._-]+/gu, "-")
      .slice(-120) || "evidencia"
  );
}

function invalid(error, status) {
  return { error, status };
}
