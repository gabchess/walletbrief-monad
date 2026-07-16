import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // execute.integration.test.ts self-gates on RUN_ANVIL_INTEGRATION=1. Bare `npm test`
    // stays green without anvil/forge installed.
    testTimeout: 30_000,
  },
});
