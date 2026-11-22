// Runs at `pnpm install`, before anything else: the API runs its TypeScript directly, which an older Node cannot do.
// pnpm does not check the root project's `engines`, so without this an older Node installs fine, then fails at
// `pnpm dev` with "Unknown file extension .ts". Plain JavaScript, so that any Node can run it.
if (!process.features.typescript) {
  console.error(
    `This project needs Node 22.18 or newer; this is Node ${process.versions.node}. Install a newer one from https://nodejs.org, then run the install again.`,
  );
  process.exit(1);
}
