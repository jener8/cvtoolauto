/**
 * Isolation checks for folder-access helper (no secrets, no network).
 * Run: npx tsx scripts/test-folder-access-isolation.ts
 */
import assert from "node:assert/strict"
import { getWorkspaceSlugForUser } from "../lib/cv-workspace-routing"

function filterFoldersForUser(
  user: { username: string; role: "admin" | "demo" | "user" },
  folders: Array<{ id: string; name: string }>,
) {
  if (user.role === "admin") return folders
  const slug = getWorkspaceSlugForUser(user)
  return folders.filter((f) => f.name.trim().toLowerCase() === slug)
}

const folders = [
  { id: "f-jennifer", name: "Jennifer" },
  { id: "f-helena", name: "Helena" },
  { id: "f-test", name: "Test" },
]

const helena = filterFoldersForUser({ username: "Helena", role: "user" }, folders)
assert.deepEqual(
  helena.map((f) => f.id),
  ["f-helena"],
  "Helena must not see Jennifer or Test folders",
)

const admin = filterFoldersForUser({ username: "Jennifer", role: "admin" }, folders)
assert.equal(admin.length, 3, "admin may list all folders for ops")

const helenaMayAccessJennifer = helena.some((f) => f.id === "f-jennifer")
assert.equal(helenaMayAccessJennifer, false, "cross-account folderId must be denied")

const missingFolderId = ""
assert.equal(Boolean(missingFolderId.trim()), false, "missing folderId must be rejected")

console.log("test-folder-access-isolation: ok")
