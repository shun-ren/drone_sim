# Validation record

DroneLab is tested at two levels: a deterministic numerical model suite and a rendered browser suite. The model runs at 100 Hz with 50 Hz recorded telemetry. Tests establish internal behavior against the authored equations and rules; they do not establish real aircraft accuracy.

## Current checks

Run from this directory with Node.js 22.13 or newer:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run examples
npm.cmd run build
```

The numerical suite in `tests/simulation.test.mjs` has 28 cases. It covers the five baseline mission successes, mission failures, forces and payload effects, motor delay, pause, battery and energy, dwell rules, gates, inspection visibility and aim, seeded wind, collision and landing, cross display cadences, recorded input replay, exports and comparison confounds.

`npm.cmd run examples` regenerates `examples/validation-results.json` and example success/failure ZIP bundles. Those results come from the same deterministic Node.js simulation core used by the browser application.

## Browser checks

**Latest run (4 Oct 2026):** all 10 existing browser tests passed against the local development server after code cleanup (headless Microsoft Edge 154.0.4258.53). The tests and application flow were unchanged. The previous production-build run on 3 Oct also passed all 10 tests.

Start the app with `npm.cmd run dev`, then in another PowerShell window run:

```powershell
npm.cmd run test:browser
```

Playwright uses Microsoft Edge in headless mode at 1440 × 1000 unless `DRONELAB_BROWSER` specifies another Chromium executable. The suite verifies five completed demonstrations and exports, inspection images, pause and presentation changes, aircraft designer persistence, recorded playback, comparison, manual movement, invalid configuration, responsive width, and the mission panel’s keyboard and mouse controls. Hiding the panel expands the same canvas without restarting an active or paused flight.

To target the compiled server, set `DRONELAB_TEST_URL` to its URL before running Playwright. The suite writes screenshots and exported test bundles below `outputs/`; these are generated locally.

## Scope of evidence

The 4 Oct cleanup removed 51 unused UI component files, one unused hook, 11 unreferenced wrappers inside retained components, eight unused direct dependencies, three write-only renderer fields/statements, six unused CSS rules and seven exact duplicate declarations. The lockfile has 416 package entries, down from 711. Approximately 6,700 source/configuration lines were removed, excluding the lockfile. Core physics, mission evaluation, storage, exports and page interactions were not changed. Lint, TypeScript and all 28 numerical tests passed, followed by the 10 browser tests above.

Unfinished city-simulator, cover and UI changes from the interrupted feature task were preserved separately before this cleanup-only pass; they are not part of this release.

The production build also passed on 4 Oct. It retains the existing advisory about large client chunks; no build errors occurred.

- Numerical cadence tests compare the same scripted model run at simulated 30, 60 and 144 display frames per second. They do not demonstrate equivalent performance across browsers or devices.
- A browser demonstration verifies one scripted successful flight per mission; it does not mean every mission has been manually piloted.
- Browser gamepad mapping is implemented, but a physical controller has not been tested. Desktop keyboard use is the primary checked input.
- Browser GPU frame rate varies by computer and graphics support. The automated browser uses headless Edge with software rendering available; its frame samples are not a hardware performance benchmark or a 60 FPS guarantee.
- Propulsion curves and component estimates are documented synthetic approximations. Terrain is authored and flat, collisions are approximate, and real map search, surveyed city structures, multiplayer, hardware control and external AI remain outside this release.
- Browser storage is local to the current origin and device. Export runs before changing origin or clearing browser data.

See [ARCHITECTURE.md](ARCHITECTURE.md) for model and subsystem detail.
