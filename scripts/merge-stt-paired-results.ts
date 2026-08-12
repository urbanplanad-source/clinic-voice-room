import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : "";
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function setDirectories(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function main() {
  const controlRoot = path.resolve(argument("control-root"));
  const candidateRoot = path.resolve(argument("candidate-root"));
  const outputRoot = path.resolve(argument("output-root"));
  const controlSets = await setDirectories(controlRoot);
  const candidateSets = await setDirectories(candidateRoot);
  if (JSON.stringify(controlSets) !== JSON.stringify(candidateSets)) {
    throw new Error("Control and candidate set IDs do not match");
  }

  for (const setId of candidateSets) {
    const controlDir = path.join(controlRoot, setId);
    const candidateDir = path.join(candidateRoot, setId);
    const outputDir = path.join(outputRoot, setId);
    const [controlRows, candidateRows] = await Promise.all([
      readFile(path.join(controlDir, "results.jsonl"), "utf8"),
      readFile(path.join(candidateDir, "results.jsonl"), "utf8")
    ]);
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputDir, "results.jsonl"), `${controlRows.trim()}\n${candidateRows.trim()}\n`, "utf8"),
      copyFile(path.join(candidateDir, "manifest.json"), path.join(outputDir, "manifest.json"))
    ]);
  }
  console.log(JSON.stringify({ outputRoot, setCount: candidateSets.length }, null, 2));
}

main().catch((caught) => {
  console.error(caught);
  process.exitCode = 1;
});

