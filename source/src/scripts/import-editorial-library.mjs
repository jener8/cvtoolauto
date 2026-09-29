/**
 * Import the editorial illustration library into public/illustrations/eq-*.png
 * and derive extra catalog copies for slots that share artwork themes.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CATALOG = path.join(ROOT, "public/illustrations")
const ASSETS = path.join(
  process.env.HOME ?? "",
  ".cursor/projects/Users-jenny-Documents-Cursor-cvresume-production-recovered/assets",
)

/** Authoritative editorial sources (user library). */
const LIBRARY_SOURCES = {
  "eq-65.png": "bf7b55f1-72f5-4b5a-a0c5-29119e7c9c1c-4e18c704-5692-413a-9431-abb319410852.png",
  "eq-66.png": "84efb008-0a41-4489-9455-cb49ce468068-cf217adc-a281-438c-b44d-24915a24f261.png",
  "eq-67.png": "301200fe-75da-40b3-8f30-8e700afa5c39-d615cbf3-3fcf-4c9c-9c74-fb403c96d87b.png",
  "eq-68.png": "e9ebaddc-7395-4ecd-874e-f611f3feab8b-4b9949db-8fa9-4515-b9c3-e03f3be15cbb.png",
  "eq-69.png": "da8090d2-846d-42cb-8af3-5d2b77339547-6f76cc3a-69ec-4547-87b8-ad4c27d80c4b.png",
  "eq-70.png": "9e155567-00a5-41b0-b4af-12bdbe808338-12729550-85ec-492d-ad41-7d86d5ced3ac.png",
  "eq-71.png": "180eaaa3-2734-4f35-98c1-64c00d484039-31e51904-4f7f-4b2c-aad8-5e242f85a6f6.png",
  "eq-72.png": "cc055a31-5ad1-4813-ac29-a288069e218f-e76700b8-a0db-4952-a6c2-7dc55316e5da.png",
  "eq-73.png": "2591d2ed-0631-437f-ba95-7966b127c6f2-f225ffe6-419e-4f95-9b9c-44d317770c8b.png",
  "eq-74.png": "41f83023-f142-4b09-8c6f-d137118d7347-cfb956c2-e48a-4ab4-bfc7-9fe1605930e1.png",
}

/** Extra catalog entries — copies of library / editorial PNGs for unique slot filenames. */
const LIBRARY_COPIES = {
  "eq-76.png": "eq-65.png",
  "eq-77.png": "eq-67.png",
  "eq-78.png": "eq-05.png",
  "eq-79.png": "eq-65.png",
  "eq-80.png": "eq-70.png",
  "eq-81.png": "eq-74.png",
  "eq-82.png": "eq-03.png",
  "eq-83.png": "eq-73.png",
  "eq-84.png": "eq-67.png",
}

function resolveAsset(name) {
  const direct = path.join(ASSETS, name)
  if (fs.existsSync(direct)) return direct
  throw new Error(`Missing library asset: ${name}`)
}

fs.mkdirSync(CATALOG, { recursive: true })

for (const [destName, sourceName] of Object.entries(LIBRARY_SOURCES)) {
  const src = resolveAsset(sourceName)
  const dest = path.join(CATALOG, destName)
  fs.copyFileSync(src, dest)
  console.log(`imported ${destName} ← ${sourceName}`)
}

for (const [destName, sourceName] of Object.entries(LIBRARY_COPIES)) {
  const src = path.join(CATALOG, sourceName)
  if (!fs.existsSync(src)) {
    console.error(`Copy source missing: ${sourceName}`)
    process.exit(1)
  }
  fs.copyFileSync(src, path.join(CATALOG, destName))
  console.log(`copied ${destName} ← ${sourceName}`)
}

console.log("Editorial library import complete.")
