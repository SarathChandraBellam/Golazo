import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Load the monorepo root .env (src/ and dist/ are at the same depth), then
// allow a package-local .env or real env vars to take precedence.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });
config();
