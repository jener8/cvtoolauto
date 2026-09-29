import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Prefer this app when another package-lock.json exists higher in the tree (e.g. home directory).
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
