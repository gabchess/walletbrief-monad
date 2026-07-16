import type { NextConfig } from "next";

// Implementation note: points Next.js at its OWN tsconfig (tsconfig.web.json) rather than
// the repo's root tsconfig.json. Keeps the backend's existing verify command
// (`npx tsc -p tsconfig.json --noEmit`) scoped to src/test/scripts exactly as
// before this ticket -- Next's app/** JSX + "bundler" moduleResolution needs
// don't touch that check at all (Surgical Changes, design rationale).
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    tsconfigPath: "tsconfig.web.json",
  },
  // src/**.ts is written for tsconfig.json's NodeNext resolution (Node ESM
  // requires the literal ".js" extension on relative imports even though the
  // source files are ".ts" -- this is how vitest/tsx run it). app/page.tsx
  // imports that same src/ tree directly (the orchestration seam), so
  // Turbopack/webpack's bundler-side resolver ALSO has to walk those ".js"
  // specifiers. Turbopack has no equivalent yet (open upstream issue,
  // vercel/next.js#82945) to webpack's `resolve.extensionAlias`, so this repo
  // builds/dev's on webpack (`next build --webpack` / `next dev --webpack`,
  // see package.json) with the alias below -- rewriting src/*.ts's own
  // NodeNext-correct imports instead would break `npm run build`'s real
  // Node-ESM `tsc --outDir dist` output.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
