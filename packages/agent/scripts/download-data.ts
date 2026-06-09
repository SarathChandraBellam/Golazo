import { ensureData, loadTable, DATASET_FILES } from "../src/data/loader.js";

await ensureData();
for (const name of DATASET_FILES) {
  console.log(`${name}: ${loadTable(name).length} rows`);
}
console.log("Dataset ready.");
