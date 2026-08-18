import {
  MAX_EVIDENCE_FILE_SIZE,
  validateEvidenceFiles,
} from "../lib/evidence-upload.mjs";

export const MAX_EVIDENCE_BASE64_LENGTH = Math.ceil(MAX_EVIDENCE_FILE_SIZE / 3) * 4 + 128;

export function buildApplicationEvidenceFormData({ applicationId, category, note, files }) {
  const decodedFiles = files.map(decodeEvidenceFile);
  const validation = validateEvidenceFiles(decodedFiles);
  if ("error" in validation) throw new Error(validation.error);

  const form = new FormData();
  form.set("entityType", "application");
  form.set("entityId", String(applicationId));
  form.set("category", category);
  form.set("note", note ?? "");
  for (const file of validation.files) form.append("files", file);
  return form;
}

function decodeEvidenceFile({ contentBase64, contentType, fileName }) {
  const encoded = contentBase64.replace(/\s+/gu, "");
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(encoded)) {
    throw new Error(`Contenido base64 inválido: ${fileName}`);
  }

  let binary;
  try {
    binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
  } catch {
    throw new Error(`Contenido base64 inválido: ${fileName}`);
  }
  if (binary.length > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error(`${fileName} supera el máximo de 12 MB.`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: contentType });
}
