import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_EVIDENCE_FILE_COUNT,
  MAX_EVIDENCE_FILE_SIZE,
  validateEvidenceFiles,
} from "../lib/evidence-upload.mjs";

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
