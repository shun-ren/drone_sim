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

The numerical suite has 31 cases in `tests/simulation.test.mjs` and `tests/city-flight.test.mjs`. It covers the five baseline mission successes, mission failures, forces and payload effects, motor delay, pause, battery and energy, dwell rules, gates, inspection visibility and aim, seeded wind, collision and landing, cross display cadences, recorded input replay, exports and comparison confounds. The city cases check coordinate conversion, independent world limits, shared aircraft physics and invalid-aircraft protection.

`npm.cmd run examples` regenerates `examples/validation-results.json` and example success/failure ZIP bundles. Those results come from the same deterministic Node.js simulation core used by the browser application.

## Browser checks

**Latest run (4 Oct 2026):** all 12 browser tests passed against the local development server in headless Microsoft Edge. The merged city simulator loaded OpenFreeMap streets and 3D building shapes; a browser flight changed GPS coordinates, and switching back preserved the paused Game flight. At 390 px width, the Delivery briefing's launch actions stayed above telemetry, and Aircraft designer remained clickable in fullscreen. The cold run exceeded the former 90-second per-test limit during the longest export-and-designer journey; its configured limit is now 180 seconds. The complete run finished in 6.5 minutes.

Start the app with `npm.cmd run dev`, then in another PowerShell window run:

```powershell
npm.cmd run test:browser
```

Playwright uses Microsoft Edge in headless mode at 1440 × 1000 unless `DRONELAB_BROWSER` specifies another Chromium executable. The suite verifies five completed demonstrations and exports, inspection images, pause and presentation changes, aircraft designer persistence, recorded playback, comparison, manual movement, invalid configuration, responsive width, and the mission panel's keyboard and mouse controls. Hiding the panel expands the same canvas without restarting an active or paused flight. Two additional checks exercise city map loading and movement, Game/Simulator separation, a narrow Delivery briefing, fullscreen navigation and the designer tab.

To target the compiled server, set `DRONELAB_TEST_URL` to its URL before running Playwright. The suite writes screenshots and exported test bundles below `outputs/`; these are generated locally.

## Scope of evidence

The 4 Oct cleanup removed 51 unused UI component files, one unused hook, 11 unreferenced wrappers inside retained components, eight unused direct dependencies, three write-only renderer fields/statements, six unused CSS rules and seven exact duplicate declarations. The lockfile has 416 package entries, down from 711. Approximately 6,700 source/configuration lines were removed, excluding the lockfile. Core physics, mission evaluation, storage, exports and page interactions were not changed. Lint, TypeScript and all 28 numerical tests passed, followed by the 10 browser tests above.

The later city feature adds the supplied README cover, a real vector-map explorer with the same aircraft physics, bounded geographic sessions, and separate Game mission state. The map screenshot in `docs/images/city-simulator.png` was captured from the running application. The old `WIP.md` note was removed after its work was integrated and verified.

The production build also passed on 4 Oct. Its compiled server passed both city/layout browser tests, including actual map loading and flight movement. The build retains an advisory about large client chunks; no build errors occurred.

`npm audit --omit=dev` currently flags six high-severity entries in one transitive Vinext/Vite plugin chain ending at `braces@3.0.3`. npm suggests downgrading Vinext to `0.0.15` rather than an in-range fix; this was not applied because it would change the application's build framework. The affected chain is used by build tooling. Recheck when compatible upstream releases are available.

- Numerical cadence tests compare the same scripted model run at simulated 30, 60 and 144 display frames per second. They do not demonstrate equivalent performance across browsers or devices.
- A browser demonstration verifies one scripted successful flight per mission; it does not mean every mission has been manually piloted.
- Browser gamepad mapping is implemented, but a physical controller has not been tested. Desktop keyboard use is the primary checked input.
- Browser GPU frame rate varies by computer and graphics support. The automated browser uses headless Edge with software rendering available; its frame samples are not a hardware performance benchmark or a 60 FPS guarantee.
- City maps require internet access and WebGL2. Their OpenStreetMap building coverage varies by location; the browser check exercises one Singapore location and does not guarantee every coordinate. Buildings do not have physical collisions or surveyed heights. Google Street View photographic free flight remains outside this release.
- Propulsion curves and component estimates are documented synthetic approximations. Training terrain is authored and flat, collisions are approximate, and address search, surveyed city structures, multiplayer, hardware control and external AI remain outside this release.
- Browser storage is local to the current origin and device. Export runs before changing origin or clearing browser data.

See [ARCHITECTURE.md](ARCHITECTURE.md) for model and subsystem detail.
