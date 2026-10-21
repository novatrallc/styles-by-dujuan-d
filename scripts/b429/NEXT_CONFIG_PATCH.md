# Required one-line build-directory isolation (do not replace your Next config)

**B4.2.9 scripts will refuse to run until this is in place.** The installer intentionally DOES NOT rewrite your Next.js configuration; your existing custom settings may be critical.

1. Stop all Next.js development and production servers first. Save a copy of your current `next.config.ts` (or `next.config.js` / `next.config.mjs`) outside the project before editing.
2. Find the **existing exported config object** and add only the `distDir` field below. Preserve every other current property/plugin.

For `next.config.ts`, when the project has `const nextConfig: NextConfig = { ... }`:

```ts
const nextConfig: NextConfig = {
  distDir: process.env.DUJUAN_BUILD_TARGET === 'dev' ? '.next-dev' : '.next',
  // Keep ALL your existing options here unchanged.
};
export default nextConfig;
```

For an existing `next.config.js`/`.mjs` object, insert the **same single property** inside its exported object:

```js
distDir: process.env.DUJUAN_BUILD_TARGET === 'dev' ? '.next-dev' : '.next',
```

**Do not copy the complete sample over your file.** If `distDir` is already defined, or the configuration exports a function, compose plugins, or uses `with...()` wrappers, stop and share its *non-secret* contents for an exact compatible patch. Never put passwords or API tokens in the config.

3. Add `.next-dev/` to `.gitignore` if it is not already ignored. Keep `.next/` ignored.
4. Use only the B4.2.9 commands below. They set the environment variable before Next starts:
   - dev mode: `DUJUAN_BUILD_TARGET=dev` -> `.next-dev` on port 3001.
   - prod mode: `DUJUAN_BUILD_TARGET=prod` -> `.next` on port 3000.
5. Do NOT run `npm run dev`/`npm run build` manually in parallel and do not run any two Next servers simultaneously for this project. The guard scripts refuse to start if another project server is detected.

If build separation is already correctly configured by another approach, use that existing approach instead and adapt the guard's configuration detection with care.
