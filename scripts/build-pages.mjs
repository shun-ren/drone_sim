import { spawnSync } from 'node:child_process';
import { cp, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const vinextCli = path.resolve('node_modules/vinext/dist/cli.js');
const result = spawnSync(process.execPath, [vinextCli, 'build', '--prerender-all'], {
  env: { ...process.env, DRONELAB_STATIC_EXPORT: 'true' },
  stdio: 'inherit',
});

if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

const client = path.resolve('dist/client');
const pagesArtifact = path.join(client, 'drone_sim');
await mkdir(pagesArtifact, { recursive: true });
for (const file of ['index.html', '404.html', 'favicon.svg', '_headers']) {
  try {
    await access(path.join(client, file));
    await cp(path.join(client, file), path.join(pagesArtifact, file), { force: true });
  } catch {
    // Optional files are omitted by some Vinext builds.
  }
}
await cp(path.join(client, 'map-worker-6.11.2'), path.join(pagesArtifact, 'map-worker-6.11.2'), { recursive: true, force: true });
