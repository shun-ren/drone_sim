# Architecture and model conventions

## Separation

`lib/sim.mjs` owns all physics, control, mission state, scoring and telemetry. It imports no graphics or browser API and is tested in Node. `lib/scene.mjs` reads a training simulation snapshot and renders it with Three.js. `lib/city-flight.mjs` reuses the aircraft physics and control model for an independent geographic exploration session. `components/city-explorer.jsx` presents that session over MapLibre streets and building outlines. `app/page.jsx` owns controls, presentation, state playback and analysis. `lib/storage.mjs` handles device-local IndexedDB and ZIP export.

Game is the scored training environment. Simulator is an independent city exploration session; switching to it pauses the training run and preserves its state. Both use the same 100 Hz aircraft dynamics, but the city has no authored gates, pads, mission scoring or history. The Game's Flight instruments control changes only the training HUD. Presentation changes during a training run are timestamped. Cameras are independent; the inspection sensor is body-mounted, with pilot-controlled pitch, and does not inherit an external chase camera's viewing direction.

## Units and dynamics

- SI units throughout: metres, seconds, kg, N, W, Wh. World X/Y horizontal, Z up. Body X forward, Y left, Z up.
- Quaternion `[x,y,z,w]`, body to world. Body angular velocity in rad/s; displayed roll/pitch/yaw in degrees.
- Rotor 1 front-left (+,+), rotor 2 front-right (+,-), rotor 3 rear-right (-,-), rotor 4 rear-left (-,+). Reaction yaw signs +,−,+,−. Rotor axes point body +Z.
- Fixed 100 Hz physics; 50 Hz telemetry. Rendering cadence does not choose the physics step. Accumulated time is stepped; a >0.5 s display interruption explicitly pauses and logs a gap rather than inventing samples. Demo time acceleration changes wall-clock pacing only.
- Each rotor supplies `Tmax × u²` thrust and `Pmax × u³ + 2u` power; avionics consume 8 W. Actual motor state follows requested command with `1 − exp(−dt/τ)`. Rotor RPM is not represented and is not exported.
- Baseline maximum thrust is 12 N per rotor, τ = 0.06 s, 22.2 V / 4 Ah pack, empty mass 1.77 kg. Payload affects mass and approximate inertia. The centered underslung payload is represented as a point mass in the pitch/roll inertia approximation; no moving payload is modeled.
- Battery is an energy reservoir: 80% nominal Wh is usable. Fixed voltage, no sag. Command, actual motor state, thrust, W, V, A and exact per-sample interval Wh are exported.
- Semi-implicit translational integration; rigid body moment integration with gyroscopic cross term and damping; normalized quaternion integration. Rotor positions generate roll/pitch moments and synthetic yaw reaction moment. No CFD, propwash, ground effect or externally calibrated airflow.
- Assisted cascade: position → desired velocity → acceleration plus bounded integral → attitude/collective → moments → rotor mixing. Attitude mode requests tilt/yaw and collective. Actuator mixing scales torque demand to available thrust headroom.

## Geometry and missions

The training area is ±100 m X/Y, with a 40 m altitude limit. Aircraft contact centre rests at Z=0.22 m; displayed altitude subtracts this contact height. Launch pad A is (−50,−35), destination B (50,−35), finish C (82,0). Mission structures are independent authored box colliders. Gate rings use swept envelope contact; valid crossings require the whole rotor envelope to fit. Contact resolution checks pre-contact vertical/horizontal speed and tilt. Structural, energy and timeout failures run before completion.

The 4 m clear gate opening is conservative for collision: finite frame thickness and the bounding rotor sphere reduce the available opening. Gate scoring checks swept directional plane crossings. The route interval starts within 8 m of gate 1 and ends at gate 8. The reference polyline includes the authored gate approach/exit segments. Out-of-order or backward crossings cannot advance.

Hold/capture/unload/recovery and excursion timers measure from the first qualifying timestamp, not an immediate timestep credit. Hover uses only the successful full hold for stability scores. Wind uses 20 s calm and 60 s wind with three seeded nonoverlapping five-second gusts. Gust recovery is confirmed after two continuous seconds inside 1 m and measured from gust end to confirmation, capped at 10 s. Unresolved events are flagged.

Delivery attaches its scenario mass once and removes it after three seconds at the destination. Mass/inertia estimates update without changing velocity. At completion, reserve must be at least 15%. Inspection targets lie at 6, 10, 14, 18 and 20 m. Captures require a geometric clear sensor line of sight, 3–5 m range, ≤15° aim error, speed <0.5 m/s and full two-second dwell. Images are virtual sensor renders; they do not perform defect detection.

All four metric qualities are linear and clamped: `(poor − value)/(poor − good)`. A pass requires mandatory objectives, no failure, and the configured minimum score (70 standard). Failure keeps a diagnostic score. Thresholds, mission version, wind seed, assistance, pilot type and initial battery are saved. Completion after the exact timeout boundary is rejected.

## Recording and persistence

Run bundle: `metadata.json`, `telemetry.csv`, `events.json`, `inputs.json`, `captures.json`, optional `inspection_images/*.png`. Interval energy is computed from the canonical physics accumulator, so its sum exactly reproduces consumed Wh. Samples contain control targets and mission targets separately; objective-distance plots use the appropriate mission target. Exact pilot input changes are stored with physics tick numbers, including sensor pitch.

Completed reports are snapshots. Periodic IndexedDB checkpoints preserve the recorded part of interrupted runs and recover as incomplete with an explicit gap; they do not pretend to resume unrecorded physics. Saved designs store empty components with versions. Browser quotas can fail; the UI reports this and export remains available.

Scrubbing is playback of recorded 50 Hz states, not a new physics run. Recorded input replay is separately verified by automated model tests. A fixed wind seed alone does not make arbitrary manual flights comparable. Comparison checks configuration differences, complete scenario settings, model/control/pilot versions and route length; plots align successful hover/wind interval starts or liftoff for other missions.

## Geographic simulator

The city flight maps a local east/north/up position in metres to longitude and latitude around the chosen origin. Preset origins cover Singapore, San Francisco, New York and Tokyo; custom coordinates accept latitudes from −80° to 80° and longitudes from −180° to 180°. Movement is bounded to 5 km from the origin and 500 m above the flat map surface. The independent city session has a 30-minute limit, keeps transient event/input memory bounded and is not written to mission history.

MapLibre streams OpenFreeMap vector tiles and OpenStreetMap-derived streets/building geometry. A versioned, locally served MapLibre module worker avoids Vite development transforms inside the Web Worker. The geographic scene requires internet access and WebGL2. Buildings are visual, with no physical collision or surveyed elevation; map coverage varies by location. The simulator does not use Google Street View photographs or claim unconstrained flight across the entire globe in one continuous session.

## Runtime

React / Vinext / Vite with Cloudflare Worker hosting. Simulation work runs locally in the browser; the optional geographic scene requests public map tiles. No AI key, map key, private connector or user data upload is required. The exact dependency versions are in package.json and package-lock.json. Synthetic catalogue data is original project data, provenance is displayed in the designer and every export.

An optional feature-detected WebMCP surface exposes read_flight_state and set_flight_presentation. It uses the same visible UI actions, validates presentation values and cleans up registrations. Native WebMCP availability is browser-dependent.
