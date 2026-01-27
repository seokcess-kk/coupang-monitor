import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/db",
  "apps/web",
  "apps/extension",
]);
