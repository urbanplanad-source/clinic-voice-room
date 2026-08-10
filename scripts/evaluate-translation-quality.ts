import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluateTranslationRows,
  parseTranslationEvaluationJsonl,
  validateEvaluationSplitIsolation
} from "../src/lib/translation-evaluation";

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: pnpm quality:evaluate <dataset.jsonl>");
  const absolutePath = resolve(inputPath);
  const parsed = parseTranslationEvaluationJsonl(await readFile(absolutePath, "utf8"));
  const errors = [...parsed.errors, ...validateEvaluationSplitIsolation(parsed.rows)];
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, inputPath: absolutePath, errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, inputPath: absolutePath, ...evaluateTranslationRows(parsed.rows) }, null, 2));
}

void main().catch((caught) => {
  console.error(caught);
  process.exitCode = 1;
});
