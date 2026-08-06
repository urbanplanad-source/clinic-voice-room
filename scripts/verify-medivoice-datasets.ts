import path from "node:path";
import readExcelFile from "read-excel-file/node";
import {
  analyzeMedivoiceDatasets,
  medivoiceDatasetSpecialties,
  type DatasetWorkbookInput
} from "../src/lib/medivoice-dataset-import";

async function main() {
  const inputPaths = process.argv.slice(2);
  if (inputPaths.length !== 3) {
    console.error("Usage: pnpm exec tsx scripts/verify-medivoice-datasets.ts <dermatology.xlsx> <plastic-surgery.xlsx> <oriental-medicine.xlsx>");
    process.exitCode = 2;
    return;
  }

  const workbooks: DatasetWorkbookInput[] = await Promise.all(inputPaths.map(async (inputPath, index) => ({
    fileName: path.basename(inputPath),
    expectedSpecialty: medivoiceDatasetSpecialties[index],
    sheets: (await readExcelFile(inputPath)).map((sheet) => ({ sheet: sheet.sheet, data: sheet.data }))
  })));

  const result = analyzeMedivoiceDatasets(workbooks);
  console.log(JSON.stringify({
    summary: result.summary,
    files: result.files,
    mergeGroups: result.mergeGroups,
    issues: result.issues
  }, null, 2));
  if (result.summary.blockerCount > 0) process.exitCode = 1;
}

void main().catch((caught) => {
  console.error(caught);
  process.exitCode = 1;
});

