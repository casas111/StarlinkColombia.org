import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_EVIDENCE_FILE_COUNT,
  MAX_EVIDENCE_FILE_SIZE,
  validateEvidenceFiles,
} from "../lib/evidence-upload.mjs";
import { buildApplicationEvidenceFormData } from "../mcp/evidence.mjs";

test("accepts images and documents in the same evidence selection", () => {
  const files = [
    new File(["image"], "instalacion.jpg", { type: "image/jpeg" }),
    new File(["document"], "entrega.pdf", { type: "application/pdf" }),
  ];

  const result = validateEvidenceFiles(files);
  assert.deepEqual(result, { files });
});

test("rejects oversized files and selections above the batch limit", () => {
  const oversized = new File([new Uint8Array(MAX_EVIDENCE_FILE_SIZE + 1)], "grande.jpg", {
    type: "image/jpeg",
  });
  assert.deepEqual(validateEvidenceFiles([oversized]), {
    error: "grande.jpg supera el máximo de 12 MB.",
    status: 413,
  });

  const files = Array.from(
    { length: MAX_EVIDENCE_FILE_COUNT + 1 },
    (_, index) => new File(["x"], `${index}.txt`, { type: "text/plain" }),
  );
  assert.deepEqual(validateEvidenceFiles(files), {
    error: "Puedes cargar máximo 10 archivos a la vez.",
    status: 400,
  });
});

test("evidence input advertises multiple mixed-file selection", async () => {
  const source = await readFile(new URL("../app/admin/AdminDashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /<input required multiple name="files" type="file"/u);
  assert.match(source, /accept="image\/\*,\.pdf,\.doc,\.docx,\.xls,\.xlsx,\.csv,\.txt"/u);
});

test("builds application evidence multipart data from base64 MCP input", async () => {
  const form = buildApplicationEvidenceFormData({
    applicationId: 42,
    category: "installation",
    files: [
      {
        contentBase64: Buffer.from("image-bytes").toString("base64"),
        contentType: "image/jpeg",
        fileName: "instalacion.jpg",
      },
      {
        contentBase64: Buffer.from("document-bytes").toString("base64"),
        contentType: "application/pdf",
        fileName: "acta.pdf",
      },
    ],
    note: "Equipo instalado y recibido",
  });

  assert.equal(form.get("entityType"), "application");
  assert.equal(form.get("entityId"), "42");
  assert.equal(form.get("category"), "installation");
  assert.equal(form.get("note"), "Equipo instalado y recibido");
  const files = form.getAll("files");
  assert.deepEqual(files.map((file) => file.name), ["instalacion.jpg", "acta.pdf"]);
  assert.deepEqual(files.map((file) => file.type), ["image/jpeg", "application/pdf"]);
  assert.equal(await files[0].text(), "image-bytes");
  assert.equal(await files[1].text(), "document-bytes");
});

test("rejects invalid base64 evidence before contacting the backend", () => {
  assert.throws(
    () =>
      buildApplicationEvidenceFormData({
        applicationId: 42,
        category: "other",
        files: [
          {
            contentBase64: "not-base64!",
            contentType: "image/png",
            fileName: "evidencia.png",
          },
        ],
      }),
    /base64 inválido/u,
  );
});
