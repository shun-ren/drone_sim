'use client';
// The fixed-step engine lives outside React. The UI samples its mutable state at 10 Hz;
// this component deliberately does not opt in to React Compiler memoization.
/* oxlint-disable react/react-compiler */
// SVG minimap and keyboard-controlled canvas are native interactive graphics.
/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-tabindex */
// Captures are browser-generated PNG data URLs, not network images.
/* oxlint-disable next/no-img-element */
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  Crosshair,
  Wind,
  Box,
  ScanLine,
  Route,
  ArrowUpRight,
  Radio,
  Play,
  Pause,
  RotateCcw,
  Download,
  Save,
  Settings2,
  Camera,
  Volume2,
  VolumeX,
  HelpCircle,
  Check,
  ChevronRight,
  AlertTriangle,
  Gauge,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Gamepad2,
  X,
  Layers,
  Cpu,
  Battery,
  Clock3,
  CheckCircle2,
  Circle,
  Maximize,
  History,
  Activity,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider as SliderPrimitive } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import {
  Simulation,
  PRESETS,
  FRAMES,
  PROPULSION,
  BATTERIES,
  MISSIONS,
  START,
  DEST,
  FINISH,
  GATES,
  PROVENANCE,
  DT,
  settingsFor,
  estimate,
  eulerFromQuaternion,
  comparison,
  clamp,
  validateSettings,
} from '@/lib/sim.mjs';
import { FlightScene } from '@/lib/scene.mjs';
import { list, put, clearCheckpoint, exportRun } from '@/lib/storage.mjs';

const icons = [Crosshair, Route, Box, ScanLine, Wind];
const terminal = (s) =>
  ['completed', 'failed', 'incomplete'].includes(s.status);
const num = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const time = (t) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(t % 60)
    .toString()
    .padStart(2, '0')}`;
function Slider(props) {
  return (
    <label className="slider-label">
      <span className="sr-only">{props['aria-label']}</span>
      <SliderPrimitive {...props} />
    </label>
  );
}
function Picker({ label, value, items, onChange, disabled = false }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Select
        value={value}
        onValueChange={(v) => v !== null && onChange(v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue>
            {items.find((i) => i.value === value)?.label || value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Metric({ label, value, unit, icon: Icon }) {
  return (
    <div className="metric">
      <span>
        {Icon && <Icon size={13} />} {label}
      </span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function MiniMap({ sim }) {
  const x = (v) => (v + 100) * 0.8,
    y = (v) => (100 - v) * 0.8;
  return (
    <div className="minimap">
      <span>
        TRAINING AREA <small>N ↑</small>
      </span>
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label="Top down flight position and mission targets"
      >
        <defs>
          <pattern
            id="mapgrid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#69e6ff"
              strokeWidth=".3"
            />
          </pattern>
        </defs>
        <rect width="160" height="160" fill="url(#mapgrid)" />
        <path
          d={`M${x(START[0])},${y(START[1])} L${x(DEST[0])},${y(DEST[1])}`}
          stroke="#97ecff"
          strokeWidth="3"
        />
        <rect x={x(5)} y={y(45)} width="8" height="8" fill="#ffe14a" />
        {[START, DEST, FINISH].map((p, i) => (
          <g key={i}>
            <circle
              cx={x(p[0])}
              cy={y(p[1])}
              r="3"
              fill="none"
              stroke="#ffe94f"
            />
            <text x={x(p[0]) + 5} y={y(p[1]) + 2} fontSize="7" fill="#efffff">
              {'ABC'[i]}
            </text>
          </g>
        ))}
        {GATES.map((g) => (
          <circle
            key={g.id}
            cx={x(g.p[0])}
            cy={y(g.p[1])}
            r="1.7"
            fill={g.id <= sim.gate ? '#ff35cf' : '#ffe05a'}
          />
        ))}
        <circle
          cx={x(sim.waypoint()[0])}
          cy={y(sim.waypoint()[1])}
          r="5"
          fill="none"
          stroke="#8cf7ff"
          strokeDasharray="2 2"
        />
        <circle
          cx={x(sim.p[0])}
          cy={y(sim.p[1])}
          r="3.5"
          fill="#fff04f"
          stroke="#102a61"
          strokeWidth="1.5"
        />
      </svg>
      <small>
        {num(sim.p[0])} E · {num(sim.p[1])} N
      </small>
    </div>
  );
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('flight'),
    [config, setConfig] = useState({ ...PRESETS[0] }),
    [settings, setSettings] = useState(settingsFor('hover')),
    [control, setControl] = useState('assisted');
  const [mode, setMode] = useState('game'),
    [camera, setCamera] = useState('chase'),
    [designs, setDesigns] = useState([]),
    [runs, setRuns] = useState([]),
    [report, setReport] = useState(null),
    [compareId, setCompareId] = useState('none');
  const [help, setHelp] = useState(false),
    [toast, setToast] = useState(''),
    [storageWarning, setStorageWarning] = useState(''),
    [renderError, setRenderError] = useState(''),
    [reduced, setReduced] = useState(false),
    [sound, setSound] = useState(false),
    [speed, setSpeed] = useState(1),
    [deadzone, setDeadzone] = useState(0.12),
    [gamepad, setGamepad] = useState('No gamepad connected'),
    [switchKey, setSwitchKey] = useState('KeyM'),
    [advanced, setAdvanced] = useState(false),
    [settingsJSON, setSettingsJSON] = useState(''),
    [scenarioError, setScenarioError] = useState(''),
    [replayTime, setReplayTime] = useState(null),
    [selectedEvent, setSelectedEvent] = useState(null),
    [fps, setFps] = useState(0),
    [, refresh] = useState(0);
  const simRef = useRef(null);
  if (!simRef.current)
    simRef.current = new Simulation(PRESETS[0], settingsFor('hover'));
  const sim = simRef.current,
    active = ['armed', 'active'].includes(sim.status),
    aircraft = estimate(config, settings.payload),
    mission = MISSIONS.find((m) => m.id === settings.mission);
  const sceneHost = useRef(null),
    sceneRef = useRef(null),
    keys = useRef(new Set()),
    touch = useRef({}),
    audio = useRef(null),
    saved = useRef(new Set()),
    speedRef = useRef(1),
    tabRef = useRef('flight'),
    notifyRef = useRef(null),
    calibration = useRef([0, 0, 0, 0]),
    deadzoneRef = useRef(0.12),
    replayRef = useRef(null),
    reportRef = useRef(null),
    playback = useRef(null),
    actions = useRef({}),
    settingsRef = useRef(settings);
  speedRef.current = speed;
  tabRef.current = tab;
  deadzoneRef.current = deadzone;
  settingsRef.current = settings;
  replayRef.current = replayTime;
  reportRef.current = report;
  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(notifyRef.current);
    notifyRef.current = setTimeout(() => setToast(''), 4500);
  }, []);
  const persistRun = useCallback(async (s) => {
    if (saved.current.has(s.id)) return;
    saved.current.add(s.id);
    const r = s.report();
    setReport(r);
    setRuns((old) => [
      r,
      ...old.filter((x) => x.metadata.id !== r.metadata.id),
    ]);
    try {
      await put('runs', { id: r.metadata.id, run: r });
      await clearCheckpoint();
    } catch {
      setStorageWarning(
        'Browser storage is unavailable or full. Export this run to keep it.',
      );
    }
    return r;
  }, []);
  const reset = useCallback(
    (cfg = config, sc = settings, ctl = control, guided = false) => {
      const old = simRef.current;
      if (active && !terminal(old)) {
        old.abort();
        void persistRun(old);
      }
      const s = new Simulation(cfg, sc, {
        control: guided ? 'assisted' : ctl,
        guided,
      });
      s.mode = mode;
      s.camera = camera;
      simRef.current = s;
      keys.current.clear();
      touch.current = {};
      setReplayTime(null);
      refresh((n) => n + 1);
      return s;
    },
    [config, settings, control, mode, camera, active, persistRun],
  );
  const start = useCallback(
    (guided) => {
      if (!ready) {
        notify('The flight field is still warming up. Try again in a moment.');
        return;
      }
      const s = reset(config, settings, control, guided);
      if (!s.arm()) {
        notify(s.reason);
        return;
      }
      setSpeed(1);
      setTab('flight');
      refresh((n) => n + 1);
      sceneHost.current?.focus();
    },
    [ready, reset, config, settings, control, notify],
  );
  const changeMode = useCallback((next) => {
    setMode(next);
    simRef.current.switchMode(next);
    refresh((n) => n + 1);
  }, []);
  const changeCamera = useCallback((next) => {
    setCamera(next);
    simRef.current.setCamera(next);
    refresh((n) => n + 1);
  }, []);
  const pause = useCallback(() => {
    simRef.current.pause();
    keys.current.clear();
    touch.current = {};
    refresh((n) => n + 1);
  }, []);
  const end = useCallback(() => {
    simRef.current.abort();
    void persistRun(simRef.current);
    refresh((n) => n + 1);
  }, [persistRun]);
  const capture = useCallback(() => {
    const result = simRef.current.capture();
    if (result.ok && sceneRef.current)
      result.capture.image = sceneRef.current.photo(
        simRef.current,
        result.capture,
      );
    notify(result.ok ? 'Inspection image captured' : result.reason);
    refresh((n) => n + 1);
  }, [notify]);
  const navigate = (next) => {
    if (next !== 'analysis') setReplayTime(null);
    if (
      next !== 'flight' &&
      ['active', 'armed'].includes(simRef.current.status) &&
      !simRef.current.paused
    ) {
      simRef.current.pause();
      notify('Flight paused. Return to the deck to resume.');
    }
    setTab(next);
  };
  actions.current = {
    start,
    changeMode,
    changeCamera,
    pause,
    end,
    capture,
    reset,
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [d, r, c] = await Promise.all([
          list('designs'),
          list('runs'),
          list('checkpoint'),
        ]);
        if (!live) return;
        setDesigns(d.map((x) => x.config));
        setRuns(
          r
            .map((x) => x.run)
            .sort((a, b) =>
              b.metadata.createdAt.localeCompare(a.metadata.createdAt),
            ),
        );
        if (c.length) {
          const interrupted = c[0].run;
          interrupted.outcome.status = 'incomplete';
          interrupted.outcome.reason =
            'Recovered after the previous session ended. Data after the last checkpoint is unavailable.';
          interrupted.events.push({
            t: interrupted.samples.at(-1)?.t || 0,
            type: 'recorder_gap',
            message: interrupted.outcome.reason,
          });
          await put('runs', { id: interrupted.metadata.id, run: interrupted });
          await clearCheckpoint();
          if (live) {
            setRuns((old) => [
              interrupted,
              ...old.filter((x) => x.metadata.id !== interrupted.metadata.id),
            ]);
            notify('An interrupted flight was recovered in Run history.');
          }
        }
      } catch {
        if (live)
          setStorageWarning(
            'Local storage is unavailable. You can still fly and export your runs.',
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [notify]);
  const showingReplay = replayTime !== null;
  useEffect(() => {
    if (!sceneHost.current) return;
    let scene,
      cancelled = false,
      preparing = true,
      warmFrame = 0;
    setReady(false);
    setRenderError('');
    const release = () => {
      scene?.dispose();
      scene = null;
    };
    const fail = (error) => {
      if (!cancelled) {
        setRenderError(
          '3D rendering could not start. Enable hardware acceleration in your browser and reload. ' +
            error.message,
        );
        setReady(false);
      }
      release();
    };
    const prepare = async () => {
      try {
        scene = new FlightScene(sceneHost.current, {
          design: tab === 'design',
          reduced,
        });
        scene.setStyle(simRef.current.mode);
        await scene.renderer.compileAsync(scene.scene, scene.camera);
        if (cancelled) {
          release();
          return;
        }
        // Draw the complete world before arming, then wait for the browser's GPU queue to finish it.
        scene.draw(simRef.current, 0);
        const gl = scene.renderer.getContext();
        if (gl.isContextLost())
          throw new Error(
            'The graphics context was lost while preparing the flight field.',
          );
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!fence)
          throw new Error('This browser could not confirm graphics readiness.');
        gl.flush();
        const poll = () => {
          if (cancelled) {
            gl.deleteSync(fence);
            release();
            return;
          }
          const result = gl.clientWaitSync(fence, 0, 0);
          if (
            result === gl.ALREADY_SIGNALED ||
            result === gl.CONDITION_SATISFIED
          ) {
            gl.deleteSync(fence);
            warmFrame = requestAnimationFrame(() => {
              if (cancelled) {
                release();
                return;
              }
              preparing = false;
              sceneRef.current = scene;
              scene.draw(simRef.current, 0);
              setReady(true);
            });
            return;
          }
          if (result === gl.WAIT_FAILED) {
            gl.deleteSync(fence);
            fail(
              new Error(
                'The browser could not finish its first graphics frame.',
              ),
            );
            return;
          }
          warmFrame = requestAnimationFrame(poll);
        };
        warmFrame = requestAnimationFrame(poll);
      } catch (error) {
        fail(error);
      }
    };
    void prepare();
    return () => {
      cancelled = true;
      cancelAnimationFrame(warmFrame);
      if (sceneRef.current === scene) sceneRef.current = null;
      if (preparing && scene) {
        scene.resizeObserver.disconnect();
        scene.renderer.domElement.remove();
      } else release();
    };
  }, [tab, reduced, showingReplay]);
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      accumulator = 0,
      lastUI = 0,
      lastPersist = 0,
      frames = 0,
      fpsSince = last;
    const loop = (now) => {
      let realDt = (now - last) / 1000;
      last = now;
      const s = simRef.current;
      if (realDt > 0.5 && ['armed', 'active'].includes(s.status) && !s.paused) {
        s.paused = true;
        s.emit(
          'recorder_gap',
          'Long display stall; flight paused without advancing simulation',
          { wallGap: realDt },
        );
        notify(
          'Flight paused after a display interruption. Resume when ready.',
        );
        accumulator = 0;
      }
      realDt = Math.min(realDt, 0.1);
      const gp = navigator.getGamepads?.()?.find((p) => p?.connected);
      const dz = (v) =>
        Math.abs(v) < deadzoneRef.current
          ? 0
          : (Math.sign(v) * (Math.abs(v) - deadzoneRef.current)) /
            (1 - deadzoneRef.current);
      const axes = gp
        ? Array.from(gp.axes).map((v, i) =>
            dz(v - (calibration.current[i] || 0)),
          )
        : [0, 0, 0, 0];
      const key = (positive, negative) =>
        (keys.current.has(positive) ? 1 : 0) -
        (keys.current.has(negative) ? 1 : 0);
      const input = {
        forward: clamp(
          key('KeyW', 'KeyS') + (touch.current.forward || 0) - (axes[3] || 0),
          -1,
          1,
        ),
        left: clamp(
          key('KeyA', 'KeyD') + (touch.current.left || 0) - (axes[2] || 0),
          -1,
          1,
        ),
        up: clamp(
          key('ArrowUp', 'ArrowDown') +
            (touch.current.up || 0) -
            (axes[1] || 0),
          -1,
          1,
        ),
        yaw: clamp(
          key('KeyQ', 'KeyE') + (touch.current.yaw || 0) - (axes[0] || 0),
          -1,
          1,
        ),
      };
      if (tabRef.current === 'flight') {
        if (s.armed && !s.paused) {
          accumulator += realDt * (s.guided ? speedRef.current : 1);
          let count = 0;
          while (accumulator >= DT - 1e-10 && count < 100) {
            s.step(input);
            accumulator -= DT;
            count++;
            if (terminal(s)) break;
          }
        } else accumulator = 0;
      }
      if (sceneRef.current) {
        let display = s;
        if (
          tabRef.current === 'analysis' &&
          reportRef.current &&
          replayRef.current !== null
        ) {
          const run = reportRef.current,
            sample =
              run.samples[
                Math.min(
                  run.samples.length - 1,
                  Math.max(0, Math.round(replayRef.current * 50) - 1),
                )
              ];
          if (sample) {
            if (playback.current?.id !== run.metadata.id)
              playback.current = new Simulation(
                run.metadata.config,
                run.metadata.settings,
                { id: run.metadata.id },
              );
            display = playback.current;
            display.mode = s.mode;
            display.camera = s.camera;
            display.p = [sample.x, sample.y, sample.z];
            display.q = [sample.qx, sample.qy, sample.qz, sample.qw];
            display.v = [sample.vx, sample.vy, sample.vz];
            display.target = [
              sample.target_x,
              sample.target_y,
              sample.target_z,
            ];
            display.motors = [
              sample.motor_actual1,
              sample.motor_actual2,
              sample.motor_actual3,
              sample.motor_actual4,
            ];
            display.payload = sample.payload_kg;
            display.aircraft = estimate(run.metadata.config, sample.payload_kg);
            display.gate = sample.gate;
            display.phase = sample.task;
            display.delivered =
              run.metadata.missionId === 'delivery' && sample.payload_kg === 0;
            display.captures = run.captures.filter((c) => c.t <= sample.t);
            display.t = sample.t;
            display.sensorPitch =
              run.inputs?.filter((i) => i.tick <= sample.t * 100).at(-1)
                ?.sensorPitch || 0;
          }
        }
        sceneRef.current.draw(display, realDt);
        for (const c of s.captures)
          if (!c.image) c.image = sceneRef.current.photo(s, c);
      }
      if (audio.current) {
        const average = s.motors.reduce((a, b) => a + b, 0) / 4;
        audio.current.osc.frequency.setTargetAtTime(
          70 + average * 230,
          audio.current.ctx.currentTime,
          0.1,
        );
        audio.current.gain.gain.setTargetAtTime(
          s.armed && !s.paused ? 0.025 * average : 0,
          audio.current.ctx.currentTime,
          0.06,
        );
      }
      if (terminal(s) && !saved.current.has(s.id) && s.samples.length)
        void persistRun(s);
      if (now - lastPersist > 5000 && s.samples.length && !terminal(s)) {
        lastPersist = now;
        void put('checkpoint', { id: 'active', run: s.report() }).catch(() =>
          setStorageWarning(
            'Checkpoint could not be saved. Export your flight after landing.',
          ),
        );
      }
      frames++;
      if (now - fpsSince > 1000) {
        setFps(Math.round((frames * 1000) / (now - fpsSince)));
        frames = 0;
        fpsSince = now;
        setGamepad(gp ? gp.id : 'No gamepad connected');
      }
      if (now - lastUI > 100) {
        refresh((n) => n + 1);
        lastUI = now;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const hidden = () => {
      keys.current.clear();
      touch.current = {};
      if (document.hidden && simRef.current.armed && !simRef.current.paused) {
        simRef.current.pause();
        notify('Flight paused while the tab is hidden.');
      }
    };
    const blur = () => {
      keys.current.clear();
      touch.current = {};
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
      audio.current?.ctx.close();
    };
  }, [notify, persistRun]);
  useEffect(() => {
    const down = (e) => {
      if (
        ['Space', 'Enter'].includes(e.code) &&
        e.target.closest('button,a,[role=button],[role=tab],[role=combobox]')
      )
        return;
      if (
        tabRef.current !== 'flight' ||
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        e.target.closest('[role="dialog"],[role="listbox"]')
      )
        return;
      const controlled = [
        'KeyW',
        'KeyS',
        'KeyA',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'KeyQ',
        'KeyE',
      ];
      if (controlled.includes(e.code)) {
        e.preventDefault();
        keys.current.add(e.code);
      }
      if (e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        actions.current.pause();
      }
      if (e.code === 'Enter' && simRef.current.status === 'ready')
        actions.current.start(false);
      if (e.code === switchKey)
        actions.current.changeMode(
          simRef.current.mode === 'game' ? 'simulator' : 'game',
        );
      if (e.code === 'KeyC') {
        const cameras = ['chase', 'fpv', 'ground'];
        actions.current.changeCamera(
          cameras[(cameras.indexOf(simRef.current.camera) + 1) % 3],
        );
      }
      if (e.code === 'KeyF') actions.current.capture();
    };
    const up = (e) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [switchKey]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'read_flight_state',
        description:
          'Read the active DroneLab aircraft, mission and telemetry summary.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => {
          const s = simRef.current;
          return {
            status: s.status,
            mission: s.spec.id,
            position: s.p,
            elapsed: s.elapsed,
            battery: s.battery,
            presentation: s.mode,
            paused: s.paused,
          };
        },
      },
      {
        name: 'set_flight_presentation',
        description:
          'Change only the active visual presentation; preserve physics and mission state.',
        inputSchema: {
          type: 'object',
          properties: { mode: { type: 'string', enum: ['game', 'simulator'] } },
          required: ['mode'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input) => {
          if (!input || !['game', 'simulator'].includes(input.mode))
            throw new Error('mode must be game or simulator');
          actions.current.changeMode(input.mode);
          await new Promise((r) => requestAnimationFrame(r));
          return { presentation: simRef.current.mode };
        },
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
  const chooseMission = (id) => {
    if (active) return;
    const next = settingsFor(id);
    setSettings(next);
    reset(config, next);
  };
  const updateConfig = (next) => {
    setConfig(next);
    if (!active) reset(next, settings);
  };
  const updateSettings = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (!active) reset(config, next);
  };
  const saveDesign = async () => {
    const current = designs.find((d) => d.id === config.id),
      name = config.name.trim();
    if (!name) {
      notify('Give your design a name.');
      return;
    }
    const next = {
      ...config,
      name,
      id: current ? config.id : crypto.randomUUID(),
      version: current ? current.version + 1 : 1,
    };
    try {
      await put('designs', { id: next.id, config: next });
      setDesigns((d) => [next, ...d.filter((x) => x.id !== next.id)]);
      updateConfig(next);
      notify(`Saved ${next.name}, version ${next.version}`);
    } catch {
      notify('Could not save design in this browser.');
    }
  };
  const soundToggle = () => {
    if (!sound && !audio.current) {
      const ctx = new AudioContext(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'triangle';
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audio.current = { ctx, osc, gain };
    }
    if (sound) {
      audio.current?.ctx.suspend();
    } else audio.current?.ctx.resume();
    setSound(!sound);
  };
  const openReport = (r) => {
    setReport(r);
    setSelectedEvent(null);
    setCompareId('none');
    setReplayTime(null);
    navigate('analysis');
  };
  const selectedComparison = runs.find((r) => r.metadata.id === compareId);
  const drag = useRef(null);
  const sceneElement = (
    <div
      ref={sceneHost}
      className={'scene-host ' + (tab === 'design' ? 'design-scene' : '')}
      tabIndex={0}
      aria-label="Flight view. W A S D move, arrow keys change altitude, Q E turn."
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x,
          dy = e.clientY - drag.current.y;
        if (simRef.current.camera === 'fpv' && tabRef.current !== 'analysis')
          simRef.current.sensorPitch = clamp(
            simRef.current.sensorPitch - dy * 0.004,
            -1.1,
            1.1,
          );
        else if (sceneRef.current) sceneRef.current.orbit -= dx * 0.005;
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {renderError && (
        <div className="render-error">
          <AlertTriangle />
          <p>{renderError}</p>
        </div>
      )}
    </div>
  );
  const [roll, pitch, yaw] = eulerFromQuaternion(sim.q).map(
    (x) => (x * 180) / Math.PI,
  );
  return (
    <main className="lab" data-ready={ready}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="DroneLab home">
          <Crosshair /> DRONE<span>LAB</span>
          <small>FLIGHT LABORATORY</small>
        </Link>
        <Tabs value={tab} onValueChange={navigate}>
          <TabsList>
            <TabsTrigger value="flight">Flight deck</TabsTrigger>
            <TabsTrigger value="design">Aircraft designer</TabsTrigger>
            <TabsTrigger value="analysis">Flight analysis</TabsTrigger>
            <TabsTrigger value="history">Run history</TabsTrigger>
          </TabsList>
        </Tabs>
        <button
          className="icon-button"
          aria-label="Controls and help"
          onClick={() => setHelp(true)}
        >
          <HelpCircle size={19} />
        </button>
      </header>
      {storageWarning && (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          {storageWarning}
        </div>
      )}
      {tab === 'flight' && (
        <div
          className={'workspace ' + (sidebarOpen ? '' : 'sidebar-collapsed')}
        >
          <aside
            id="mission-sidebar"
            className="briefing"
            hidden={!sidebarOpen}
          >
            <div className="eyebrow">THE TRAINING SERIES</div>
            <h1>
              Make every
              <br />
              flight an experiment.
            </h1>
            <p className="muted">Configure. Fly. Understand.</p>
            <div className="section-title">
              SELECT A MISSION <span>5 AVAILABLE</span>
            </div>
            {MISSIONS.map((m, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={m.id}
                  data-mission={m.id}
                  disabled={active}
                  aria-pressed={m.id === settings.mission}
                  className={
                    'mission-card ' +
                    (m.id === settings.mission ? 'selected' : '')
                  }
                  onClick={() => chooseMission(m.id)}
                >
                  <Icon />
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.subtitle}</small>
                  </div>
                  <span>0{i + 1}</span>
                </button>
              );
            })}
            <div className="aircraft-mini">
              <Radio />
              <div>
                <strong>{config.name}</strong>
                <small>
                  {num(aircraft.mass, 2)} kg · {num(aircraft.ratio, 2)} thrust /
                  weight
                </small>
              </div>
              <button
                className="icon-button"
                aria-label="Edit aircraft"
                onClick={() => navigate('design')}
              >
                <Settings2 size={16} />
              </button>
            </div>
            <Picker
              label="Flight control"
              value={control}
              items={[
                { value: 'assisted', label: 'Assisted · position hold' },
                { value: 'attitude', label: 'Attitude · manual collective' },
              ]}
              disabled={active}
              onChange={(v) => {
                setControl(v);
                reset(config, settings, v);
              }}
            />
            <button
              className="text-button"
              onClick={() => {
                setSettingsJSON(JSON.stringify(settings, null, 2));
                setScenarioError('');
                setAdvanced(true);
              }}
              disabled={active}
            >
              <Settings2 size={14} /> Scenario settings
            </button>
            <p className="model-note">
              Educational model · synthetic component curves. Training terrain
              only.
            </p>
          </aside>
          <section
            className={
              'flight-panel ' + (mode === 'simulator' ? 'simulator' : '')
            }
          >
            <div className="scene-wrap">
              {sceneElement}
              <div className="scene-top">
                <div>
                  <div className="eyebrow">FIELD 01 / TRAINING GROUNDS</div>
                  <h2>{mission.name}</h2>
                  <div className="scene-tags">
                    <span>
                      <i /> {sim.paused ? 'PAUSED' : sim.status.toUpperCase()}
                    </span>
                    <span>
                      {sim.guided ? 'DEMO PILOT' : control.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="view-controls">
                  <Tabs value={mode} onValueChange={changeMode}>
                    <TabsList>
                      <TabsTrigger value="game">Game</TabsTrigger>
                      <TabsTrigger value="simulator">Simulator</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Picker
                    label="Camera"
                    value={camera}
                    items={[
                      { value: 'chase', label: 'Chase camera' },
                      { value: 'fpv', label: 'FPV camera' },
                      { value: 'ground', label: 'Ground pilot' },
                    ]}
                    onChange={changeCamera}
                  />
                  <button
                    type="button"
                    className="sidebar-toggle"
                    aria-controls="mission-sidebar"
                    aria-expanded={sidebarOpen}
                    onClick={() => setSidebarOpen((open) => !open)}
                  >
                    {sidebarOpen ? (
                      <PanelLeftClose size={16} />
                    ) : (
                      <PanelLeftOpen size={16} />
                    )}{' '}
                    {sidebarOpen ? 'Hide missions' : 'Show missions'}
                  </button>
                  <div className="view-buttons">
                    <button
                      className="icon-button"
                      aria-label={sound ? 'Mute motors' : 'Enable motor sound'}
                      onClick={soundToggle}
                    >
                      {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={
                        reduced ? 'Enable full detail' : 'Enable reduced detail'
                      }
                      aria-pressed={reduced}
                      onClick={() => setReduced(!reduced)}
                    >
                      <Layers size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Fullscreen flight view"
                      onClick={() =>
                        sceneHost.current?.parentElement
                          ?.requestFullscreen?.()
                          .catch(() => notify('Fullscreen is not available.'))
                      }
                    >
                      <Maximize size={16} />
                    </button>
                  </div>
                </div>
              </div>
              {sim.status === 'ready' && (
                <div className="launch-card">
                  <div className="eyebrow">MISSION BRIEFING</div>
                  <h3>{mission.subtitle}</h3>
                  <p>{mission.brief}</p>
                  <div className="brief-facts">
                    <span>
                      <Clock3 size={14} />
                      {settings.limit} s limit
                    </span>
                    <span>
                      <Wind size={14} />
                      {settings.wind} m/s wind
                    </span>
                    <span>
                      <Box size={14} />
                      {settings.payload} kg payload
                    </span>
                  </div>
                  <ol>
                    {mission.steps.map((step) => (
                      <li key={step}>
                        <Circle size={12} />
                        {step}
                      </li>
                    ))}
                  </ol>
                  {aircraft.errors.map((e) => (
                    <p className="error-text" key={e}>
                      {e}
                    </p>
                  ))}
                  <button
                    className="primary full"
                    disabled={!ready || !aircraft.valid || !!renderError}
                    onClick={() => start(false)}
                  >
                    <Play size={16} fill="currentColor" /> Arm & fly{' '}
                    <span>↵</span>
                  </button>
                  <button
                    className="secondary full"
                    disabled={!ready || !aircraft.valid || !!renderError}
                    onClick={() => start(true)}
                  >
                    <Play size={15} /> Watch demonstration
                  </button>
                  <small>
                    Demo uses repeatable pilot commands and the same physics.
                  </small>
                </div>
              )}
              {sim.status !== 'ready' && !terminal(sim) && (
                <>
                  <div className="objective">
                    <div className="eyebrow">
                      CURRENT OBJECTIVE{' '}
                      <span>
                        {time(sim.elapsed)} / {time(settings.limit)}
                      </span>
                    </div>
                    <strong>{sim.objective}</strong>
                    <Progress
                      value={sim.progress * 100}
                      aria-label="Mission progress"
                    />
                    <small>
                      {sim.guided
                        ? 'Demonstration flight · inputs recorded'
                        : control === 'assisted'
                          ? 'Release the movement keys to hold position'
                          : 'Attitude mode: altitude requires pilot input'}
                    </small>
                  </div>
                  {sim.paused && (
                    <div className="pause-card">
                      <Pause size={26} />
                      <h3>Flight paused</h3>
                      <p>Aircraft, battery and mission timer are frozen.</p>
                      <button className="primary" onClick={pause}>
                        <Play size={16} /> Resume flight
                      </button>
                    </div>
                  )}
                </>
              )}
              {terminal(sim) && (
                <div className="completion-card">
                  <div
                    className={
                      'result-icon ' +
                      (sim.status === 'completed' ? 'good' : 'bad')
                    }
                  >
                    {sim.status === 'completed' ? (
                      <CheckCircle2 />
                    ) : (
                      <AlertTriangle />
                    )}
                  </div>
                  <div className="eyebrow">FLIGHT RECORDED</div>
                  <h3>
                    {sim.status === 'completed'
                      ? 'Mission accomplished'
                      : sim.status === 'failed'
                        ? 'Flight needs a review'
                        : 'Flight ended'}
                  </h3>
                  <p>{sim.reason}</p>
                  <strong className="score-large">
                    {num(sim.score().total, 0)}
                    <small>/ 100</small>
                  </strong>
                  <button
                    className="primary full"
                    onClick={() => openReport(sim.report())}
                  >
                    Open flight debrief <ArrowUpRight size={17} />
                  </button>
                  <button className="secondary full" onClick={() => reset()}>
                    Prepare another flight
                  </button>
                </div>
              )}
              {mode === 'simulator' && (
                <div className="instrument-strip">
                  <span>
                    ROLL <b>{num(roll)}°</b>
                  </span>
                  <span>
                    PITCH <b>{num(pitch)}°</b>
                  </span>
                  <span>
                    HDG <b>{num((yaw + 360) % 360, 0)}°</b>
                  </span>
                  <span>
                    V/S <b>{num(sim.v[2])} m/s</b>
                  </span>
                  <span>
                    POS{' '}
                    <b>
                      {num(sim.p[0])}, {num(sim.p[1])}
                    </b>
                  </span>
                </div>
              )}
              <MiniMap sim={sim} />
              <div className="scene-caption">
                <span className="live-dot" /> 200 × 200 m flight area{' '}
                <span>40 m ceiling</span>
              </div>
            </div>
            <div className="telemetry-strip">
              <Metric
                label="ALTITUDE"
                value={num(sim.altitude)}
                unit="m"
                icon={ArrowUp}
              />
              <Metric
                label="GROUND SPEED"
                value={num(sim.speed)}
                unit="m/s"
                icon={Gauge}
              />
              <Metric
                label="BATTERY"
                value={num(sim.battery * 100, 0)}
                unit="%"
                icon={Battery}
              />
              <Metric
                label="POWER"
                value={num(sim.power, 0)}
                unit="W"
                icon={Activity}
              />
              <Metric
                label="WIND"
                value={num(Math.hypot(...sim.wind))}
                unit="m/s"
                icon={Wind}
              />
              <div className="motor-meters">
                <span>MOTOR COMMAND</span>
                <div>
                  {sim.commands.map((v, i) => (
                    <div key={i}>
                      <i style={{ height: `${Math.max(4, v * 40)}px` }} />
                      <small>{i + 1}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flight-actions">
              <div className="key-guide">
                <span>
                  <kbd>W A S D</kbd> Move
                </span>
                <span>
                  <kbd>↑ ↓</kbd> Altitude
                </span>
                <span>
                  <kbd>Q E</kbd> Yaw
                </span>
                <span>
                  <kbd>{switchKey.replace('Key', '')}</kbd> Look
                </span>
              </div>
              <div className="action-buttons">
                {active && (
                  <>
                    <button className="secondary" onClick={pause}>
                      {sim.paused ? <Play size={15} /> : <Pause size={15} />}{' '}
                      {sim.paused ? 'Resume' : 'Pause'}
                    </button>
                    {settings.mission === 'inspection' && (
                      <button className="secondary" onClick={capture}>
                        <Camera size={15} /> Capture
                      </button>
                    )}
                    <button className="secondary danger" onClick={end}>
                      <X size={15} /> End flight
                    </button>
                  </>
                )}
                {sim.guided && active && (
                  <Picker
                    label="Demo speed"
                    value={String(speed)}
                    items={[1, 2, 4].map((v) => ({
                      value: String(v),
                      label: v + '×',
                    }))}
                    onChange={(v) => setSpeed(Number(v))}
                  />
                )}
              </div>
            </div>
            <div className="touch-controls">
              {[
                ['Forward', 'forward', 1, ArrowUp],
                ['Back', 'forward', -1, ArrowDown],
                ['Left', 'left', 1, ArrowLeft],
                ['Right', 'left', -1, ArrowRight],
                ['Climb', 'up', 1, ArrowUp],
                ['Descend', 'up', -1, ArrowDown],
              ].map(([label, k, v, Icon]) => (
                <button
                  key={label}
                  className="secondary"
                  aria-label={label}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touch.current[k] = v;
                  }}
                  onPointerUp={() => (touch.current[k] = 0)}
                  onPointerCancel={() => (touch.current[k] = 0)}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
            <footer className="flight-footer">
              <span>
                <i className="live-dot" />{' '}
                {renderError ? 'GRAPHICS UNAVAILABLE' : 'SHARED FLIGHT MODEL'}
              </span>
              <span>
                {fps} FPS · {reduced ? 'REDUCED' : 'FULL'} DETAIL
              </span>
              <span>100 Hz PHYSICS / 50 Hz TELEMETRY</span>
            </footer>
          </section>
        </div>
      )}
      {tab === 'design' && (
        <div className="designer content-page">
          <div className="page-heading">
            <div>
              <div className="eyebrow">THE AIRCRAFT WORKSHOP</div>
              <h1>Built to explore.</h1>
              <p className="muted">
                Change one component. See what it changes in flight.
              </p>
            </div>
            <button className="primary" disabled={active} onClick={saveDesign}>
              <Save size={17} /> Save design
            </button>
          </div>
          {active && (
            <div className="warning-banner">
              Your flight is paused. End it from the flight deck before editing
              its aircraft.
            </div>
          )}
          <div className="designer-grid">
            <section className="design-config">
              <Picker
                label="Start with an aircraft"
                value={config.id}
                items={[...PRESETS, ...designs].map((c) => ({
                  value: c.id,
                  label:
                    c.name + (designs.includes(c) ? ` · v${c.version}` : ''),
                }))}
                disabled={active}
                onChange={(id) =>
                  updateConfig({
                    ...[...PRESETS, ...designs].find((c) => c.id === id),
                  })
                }
              />
              <label className="field">
                Design name
                <Input
                  value={config.name}
                  disabled={active}
                  maxLength={60}
                  onChange={(e) =>
                    updateConfig({ ...config, name: e.target.value })
                  }
                />
              </label>
              {[
                ['Frame', 'frame', FRAMES],
                ['Propulsion package', 'propulsion', PROPULSION],
                ['Battery', 'battery', BATTERIES],
              ].map(([label, key, options]) => (
                <Picker
                  key={key}
                  label={label}
                  value={config[key]}
                  items={options.map((c) => ({ value: c.id, label: c.name }))}
                  disabled={active}
                  onChange={(value) =>
                    updateConfig({ ...config, [key]: value })
                  }
                />
              ))}
              <Picker
                label="Controller response"
                value={config.controller}
                items={['gentle', 'balanced', 'agile'].map((v) => ({
                  value: v,
                  label: v[0].toUpperCase() + v.slice(1),
                }))}
                disabled={active}
                onChange={(v) => updateConfig({ ...config, controller: v })}
              />
              <div className="field">
                <div className="field-label">
                  Scenario payload <b>{settings.payload.toFixed(1)} kg</b>
                </div>
                <Slider
                  aria-label="Scenario payload"
                  min={0}
                  max={2.5}
                  step={0.1}
                  value={[settings.payload]}
                  disabled={active || settings.mission === 'delivery'}
                  onValueChange={(v) =>
                    updateSettings('payload', Array.isArray(v) ? v[0] : v)
                  }
                />
                <small>
                  {settings.mission === 'delivery'
                    ? 'Delivery supplies exactly 1 kg.'
                    : 'Applied once at launch; saved designs remain empty.'}
                </small>
              </div>
            </section>
            <section className="design-preview">
              {sceneElement}
              <div className="design-preview-title">
                <span className="eyebrow">X CONFIGURATION / QUADCOPTER</span>
                <h2>{config.name}</h2>
                <small>
                  {config.version
                    ? 'VERSION ' + config.version
                    : 'UNSAVED DESIGN'}
                </small>
              </div>
              <div
                className={
                  'validation ' + (aircraft.valid ? 'valid' : 'invalid')
                }
              >
                {aircraft.valid ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}
                <div>
                  <strong>
                    {aircraft.valid
                      ? 'Configuration ready for flight'
                      : 'Configuration cannot launch'}
                  </strong>
                  {[...aircraft.errors, ...aircraft.warnings].map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                  {aircraft.valid && !aircraft.warnings.length && (
                    <p>
                      Voltage, clearance, current and payload checks passed.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <section className="estimate-card">
              <div className="eyebrow">PREFLIGHT ESTIMATES</div>
              <h3>
                A little engineering
                <br />
                before takeoff.
              </h3>
              <div className="estimate-grid">
                <Metric
                  label="LOADED MASS"
                  value={num(aircraft.mass, 2)}
                  unit="kg"
                />
                <Metric
                  label="MAX THRUST"
                  value={num(aircraft.thrust, 0)}
                  unit="N"
                />
                <Metric
                  label="THRUST / WEIGHT"
                  value={num(aircraft.ratio, 2)}
                  unit="×"
                />
                <Metric
                  label="HOVER COMMAND"
                  value={num(aircraft.hover * 100, 0)}
                  unit="%"
                />
                <Metric
                  label="HOVER POWER"
                  value={num(aircraft.power, 0)}
                  unit="W"
                />
                <Metric
                  label="HOVER ENDURANCE"
                  value={`${num(aircraft.endurance * 0.85, 0)}–${num(aircraft.endurance, 0)}`}
                  unit="min"
                />
              </div>
              <p className="muted">
                Endurance range assumes steady hover, 80% usable nominal
                capacity and 15% reserve, with up to 15% extra demand. These are
                model estimates, not measured aircraft performance.
              </p>
              <button
                className="primary full"
                disabled={!aircraft.valid}
                onClick={() => navigate('flight')}
              >
                Use on the flight deck <ArrowUpRight size={16} />
              </button>
            </section>
          </div>
          <details className="model-details">
            <summary>Component data, equations & model limits</summary>
            <p>{PROVENANCE}</p>
            <p>
              Baseline: 1.77 kg empty, 48 N maximum thrust, 0.06 s motor
              response. Drag uses air-relative velocity. Six degree of freedom
              rigid body motion uses quaternion orientation and bounded
              per-motor forces. The 1 kg delivery load updates mass and
              approximate inertia; it is removed without an artificial velocity
              impulse.
            </p>
            <p>
              Collisions use conservative rotor-envelope geometry. Terrain is
              flat. There is no photorealistic map, validated urban airflow,
              real aircraft certification or external AI service.
            </p>
          </details>
        </div>
      )}
      {tab === 'analysis' && (
        <div className="content-page analysis">
          <div className="page-heading">
            <div>
              <div className="eyebrow">POSTFLIGHT LABORATORY</div>
              <h1>Every flight tells a story.</h1>
            </div>
            {report && (
              <button className="primary" onClick={() => exportRun(report)}>
                <Download size={17} /> Export run bundle
              </button>
            )}
          </div>
          {!report ? (
            <div className="empty-state">
              <Activity size={38} />
              <h2>Your first flight starts the story.</h2>
              <p>
                Fly a mission or watch its demonstration to record telemetry and
                open a debrief.
              </p>
              <button className="primary" onClick={() => navigate('flight')}>
                Go to flight deck <ArrowUpRight size={16} />
              </button>
              {runs.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => setReport(runs[0])}
                >
                  Open most recent run
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="report-overview">
                <div
                  className={
                    'report-score ' +
                    (report.outcome.status === 'completed' ? 'good' : 'bad')
                  }
                >
                  <strong>{num(report.outcome.score.total, 0)}</strong>
                  <span>/ 100</span>
                </div>
                <div>
                  <span className="eyebrow">
                    {report.metadata.missionId.toUpperCase()} ·{' '}
                    {report.metadata.pilot.toUpperCase()}
                  </span>
                  <h2>
                    {report.outcome.status === 'completed'
                      ? 'Mission completed'
                      : report.outcome.status === 'failed'
                        ? 'Mission failed'
                        : 'Incomplete flight'}
                  </h2>
                  <p>{report.outcome.reason}</p>
                  <small>
                    {report.metadata.config.name} · v
                    {report.metadata.config.version} · {report.metadata.control}{' '}
                    · seed {report.metadata.settings.seed}
                  </small>
                </div>
                <div className="report-metrics">
                  <Metric
                    label="FLIGHT TIME"
                    value={num(report.outcome.elapsed)}
                    unit="s"
                  />
                  <Metric
                    label="CONSUMED"
                    value={num(report.outcome.energy, 2)}
                    unit="Wh"
                  />
                  <Metric
                    label="REMAINING"
                    value={num(report.outcome.battery * 100, 0)}
                    unit="%"
                  />
                </div>
              </div>
              <div className="report-toolbar">
                <Picker
                  label="Compare with a run"
                  value={compareId}
                  items={[
                    { value: 'none', label: 'No comparison' },
                    ...runs
                      .filter((r) => r.metadata.id !== report.metadata.id)
                      .map((r) => ({
                        value: r.metadata.id,
                        label: `${r.metadata.config.name} · ${r.metadata.missionId} · ${num(r.outcome.score.total, 0)}`,
                      })),
                  ]}
                  onChange={setCompareId}
                />
                <button
                  className="secondary"
                  onClick={() => {
                    setConfig({ ...report.metadata.config });
                    const next = { ...report.metadata.settings };
                    setSettings(next);
                    setControl(report.metadata.control);
                    reset(
                      report.metadata.config,
                      next,
                      report.metadata.control,
                    );
                    navigate('design');
                  }}
                >
                  Change design & repeat <RotateCcw size={15} />
                </button>
                <button
                  className="secondary"
                  onClick={() => setReplayTime(replayTime === null ? 0 : null)}
                >
                  <Play size={15} />{' '}
                  {replayTime === null
                    ? 'Open recorded playback'
                    : 'Close playback'}
                </button>
              </div>
              {selectedComparison && (
                <ComparisonInfo a={report} b={selectedComparison} />
              )}
              {replayTime !== null && (
                <section className="replay">
                  <div className="replay-scene">{sceneElement}</div>
                  <div className="replay-controls">
                    <div className="field-label">
                      Recorded state playback · {num(replayTime)} s
                    </div>
                    <Slider
                      aria-label="Playback time"
                      min={0}
                      max={report.samples.at(-1)?.t || 1}
                      step={0.02}
                      value={[replayTime]}
                      onValueChange={(v) =>
                        setReplayTime(Array.isArray(v) ? v[0] : v)
                      }
                    />
                    <small>
                      Scrub recorded 50 Hz poses; this does not rerun physics.
                    </small>
                  </div>
                </section>
              )}
              <div className="report-body">
                <section>
                  <div className="section-heading">
                    <h3>Measured performance</h3>
                    <span>
                      Score requires all objectives +{' '}
                      {report.metadata.settings.passScore} points
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Recorded</TableHead>
                        <TableHead>Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.outcome.score.metrics.map((m) => (
                        <TableRow key={m.label}>
                          <TableCell>
                            {m.label}
                            <small className="threshold">
                              Full points ≤ {m.good} · zero ≥ {m.poor}
                            </small>
                          </TableCell>
                          <TableCell>
                            {num(m.value, 2)} {m.unit}
                          </TableCell>
                          <TableCell>
                            <div className="score-cell">
                              <Progress
                                value={m.quality * 100}
                                aria-label={m.label + ' score'}
                              />
                              <span>
                                {num(m.points, 1)} / {m.weight}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="section-heading chart-heading">
                    <h3>Flight telemetry</h3>
                    <span>
                      {selectedComparison
                        ? 'Aligned evaluation time'
                        : 'Simulation time'}{' '}
                      · hover a plot to inspect
                    </span>
                  </div>
                  <TelemetryPlots
                    run={report}
                    comparison={selectedComparison}
                    event={selectedEvent}
                  />
                </section>
                <aside className="analysis-sidebar">
                  <h3>Engineering notes</h3>
                  <p className="muted">
                    Computed from this flight. Each finding links to its
                    measured evidence.
                  </p>
                  {report.findings.map((f) => (
                    <button
                      className="finding"
                      key={f.title}
                      onClick={() =>
                        document
                          .getElementById('plot-' + f.chart)
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          })
                      }
                    >
                      <div>
                        <Cpu size={17} />
                        <strong>{f.title}</strong>
                        <ArrowUpRight size={15} />
                      </div>
                      <p>{f.text}</p>
                      <small>View evidence</small>
                    </button>
                  ))}
                  <h3 className="events-heading">Flight events</h3>
                  <div className="events-list">
                    {report.events
                      .filter(
                        (e) =>
                          ![
                            'ready',
                            'saturation_start',
                            'saturation_end',
                          ].includes(e.type),
                      )
                      .map((e, i) => (
                        <button
                          className={
                            'event ' + (selectedEvent === e ? 'selected' : '')
                          }
                          key={i}
                          onClick={() => setSelectedEvent(e)}
                        >
                          <span>{num(e.t, 2)} s</span>
                          <strong>{e.message}</strong>
                        </button>
                      ))}
                  </div>
                  {selectedEvent && (
                    <button
                      className="text-button"
                      onClick={() => setSelectedEvent(null)}
                    >
                      Clear plot highlight
                    </button>
                  )}
                </aside>
              </div>
              {report.captures?.length > 0 && (
                <section className="capture-gallery">
                  <h3>Inspection captures</h3>
                  <div>
                    {report.captures.map((c) => (
                      <article key={c.id}>
                        {c.image ? (
                          <img
                            src={c.image}
                            alt={`Sensor view of target ${c.id}`}
                          />
                        ) : (
                          <div className="capture-placeholder">
                            Geometric test capture · no image recorded
                          </div>
                        )}
                        <strong>
                          {c.id} · {num(c.t)} s
                        </strong>
                        <small>
                          {num(c.range, 2)} m · {num(c.angle, 1)}° ·{' '}
                          {num(c.speed, 2)} m/s
                        </small>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              <details className="model-details">
                <summary>Reproducibility & saved scenario</summary>
                <p>{report.metadata.provenance}</p>
                <p>
                  {report.metadata.frame}. Quaternion:{' '}
                  {report.metadata.quaternion}. Model{' '}
                  {report.metadata.modelVersion}. {report.metadata.physicsHz} Hz
                  physics / {report.metadata.samplingHz} Hz telemetry.
                  Measurements use the recorded evaluation intervals.
                </p>
                <pre>
                  {JSON.stringify(
                    {
                      settings: report.metadata.settings,
                      intervals: report.intervals,
                      configuration: report.metadata.config,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
      {tab === 'history' && (
        <div className="content-page">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR FLIGHT NOTEBOOK</div>
              <h1>Keep the evidence.</h1>
              <p className="muted">
                Saved in this browser on this device. Export bundles to keep a
                portable copy.
              </p>
            </div>
            <span className="count-label">{runs.length} RECORDED RUNS</span>
          </div>
          {runs.length === 0 ? (
            <div className="empty-state">
              <History size={38} />
              <h2>No flights recorded yet.</h2>
              <p>
                Completed, failed and aborted flights all have a place here.
              </p>
              <button className="primary" onClick={() => navigate('flight')}>
                Fly your first mission
              </button>
            </div>
          ) : (
            <div className="history-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mission / aircraft</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Energy</TableHead>
                    <TableHead>Recorded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.metadata.id}>
                      <TableCell>
                        <strong>
                          {
                            MISSIONS.find((m) => m.id === r.metadata.missionId)
                              ?.name
                          }
                        </strong>
                        <small className="threshold">
                          {r.metadata.config.name} · v
                          {r.metadata.config.version}
                        </small>
                      </TableCell>
                      <TableCell>
                        <span className={'outcome-tag ' + r.outcome.status}>
                          {r.outcome.status}
                        </span>
                      </TableCell>
                      <TableCell>{num(r.outcome.score.total, 0)}</TableCell>
                      <TableCell>{num(r.outcome.elapsed)} s</TableCell>
                      <TableCell>{num(r.outcome.energy, 2)} Wh</TableCell>
                      <TableCell>
                        {new Date(r.metadata.createdAt).toLocaleString()}
                        <small className="threshold">{r.metadata.pilot}</small>
                      </TableCell>
                      <TableCell>
                        <div className="row-actions">
                          <button
                            className="secondary"
                            onClick={() => openReport(r)}
                          >
                            Debrief <ArrowUpRight size={14} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Export ${r.metadata.missionId} run`}
                            onClick={() => exportRun(r)}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="saved-designs">
            <h3>Saved aircraft</h3>
            {designs.length ? (
              designs.map((d) => (
                <button
                  className="saved-design"
                  key={d.id}
                  disabled={active}
                  onClick={() => {
                    updateConfig({ ...d });
                    navigate('design');
                  }}
                >
                  <Radio />
                  <div>
                    <strong>{d.name}</strong>
                    <small>
                      Version {d.version} · {d.frame} / {d.propulsion}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <p className="muted">
                Save a design in the aircraft workshop to keep your component
                choices.
              </p>
            )}
          </div>
        </div>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogHeader>
            <DialogTitle>You’re the pilot.</DialogTitle>
            <DialogDescription>
              Assisted mode is the easiest place to start. Keyboard input is
              active on the flight deck.
            </DialogDescription>
          </DialogHeader>
          <div className="binding-list">
            {[
              ['W / S', 'Forward / backward'],
              ['A / D', 'Left / right'],
              ['↑ / ↓', 'Climb / descend'],
              ['Q / E', 'Turn left / right'],
              ['Enter', 'Arm aircraft'],
              ['Space', 'Pause / resume'],
              ['C', 'Cycle camera'],
              ['F', 'Capture inspection image'],
              [switchKey.replace('Key', ''), 'Switch Game / Simulator'],
            ].map(([k, v]) => (
              <div key={k}>
                <kbd>{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <p className="muted">
            Release movement keys to hold position in Assisted. In Attitude, W/S
            and A/D command tilt; ↑/↓ adjust collective around estimated hover
            demand. Descend below 0.5 m/s onto a marked pad. Drag the chase view
            to orbit; in FPV, drag vertically to aim the sensor.
          </p>
          <Picker
            label="Presentation shortcut"
            value={switchKey}
            items={['KeyM', 'KeyV', 'KeyB'].map((v) => ({
              value: v,
              label: v.slice(-1),
            }))}
            onChange={setSwitchKey}
          />
          <div className="gamepad-settings">
            <Gamepad2 />
            <strong>{gamepad}</strong>
            <p>
              Standard mapping: left stick yaw / climb, right stick movement.
              Center both sticks before calibration.
            </p>
            <button
              className="secondary"
              onClick={() => {
                const gp = navigator.getGamepads?.()?.find((p) => p?.connected);
                if (gp) {
                  calibration.current = Array.from(gp.axes);
                  notify('Gamepad centers calibrated.');
                } else
                  notify(
                    'Connect a standard gamepad and press a button first.',
                  );
              }}
            >
              Calibrate stick centers
            </button>
            <div className="field-label">
              Dead zone · {Math.round(deadzone * 100)}%
            </div>
            <Slider
              min={0.05}
              max={0.35}
              step={0.01}
              value={[deadzone]}
              onValueChange={(v) => setDeadzone(Array.isArray(v) ? v[0] : v)}
              aria-label="Gamepad dead zone"
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={advanced} onOpenChange={setAdvanced}>
        <DialogContent className="scenario-dialog">
          <DialogHeader>
            <DialogTitle>Scenario settings</DialogTitle>
            <DialogDescription>
              These settings are saved with every run. Different settings change
              score comparability.
            </DialogDescription>
          </DialogHeader>
          <div className="scenario-fields">
            <label>
              Wind seed
              <Input
                type="number"
                min="0"
                value={settings.seed}
                onChange={(e) => updateSettings('seed', Number(e.target.value))}
              />
            </label>
            <label>
              Initial usable battery (%)
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.initialBattery * 100}
                onChange={(e) =>
                  updateSettings('initialBattery', Number(e.target.value) / 100)
                }
              />
            </label>
            <label>
              Wind (m/s)
              <Input
                type="number"
                min="0"
                max="12"
                step=".5"
                value={settings.wind}
                onChange={(e) => updateSettings('wind', Number(e.target.value))}
              />
            </label>
            <label>
              Time limit (s)
              <Input
                type="number"
                min="1"
                max="1800"
                value={settings.limit}
                onChange={(e) =>
                  updateSettings('limit', Number(e.target.value))
                }
              />
            </label>
          </div>
          <details>
            <summary>Edit all thresholds as JSON</summary>
            <textarea
              aria-label="Scenario JSON"
              value={settingsJSON}
              onChange={(e) => setSettingsJSON(e.target.value)}
            />
            <button
              className="secondary"
              onClick={() => {
                try {
                  const next = JSON.parse(settingsJSON);
                  const errors = validateSettings(next);
                  if (next.mission !== settings.mission)
                    errors.push('Choose missions on the flight deck.');
                  if (errors.length) throw new Error(errors.join(' '));
                  setSettings(next);
                  reset(config, next);
                  setScenarioError('');
                  notify('Thresholds applied.');
                } catch (e) {
                  setScenarioError(e.message);
                }
              }}
            >
              Apply JSON thresholds
            </button>
          </details>
          {[
            ...validateSettings(settings),
            ...(scenarioError ? [scenarioError] : []),
          ].map((e) => (
            <p key={e} className="error-text">
              {e}
            </p>
          ))}
          <button
            className="primary"
            onClick={() => {
              if (validateSettings(settings).length) return;
              setAdvanced(false);
            }}
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </main>
  );
}

function ComparisonInfo({ a, b }) {
  const c = comparison(a, b);
  return (
    <section className="comparison-info">
      <h3>A / B comparison</h3>
      {c.mismatches.length ? (
        <p className="warning-text">
          These runs cannot isolate a design effect: {c.mismatches.join(', ')}.
        </p>
      ) : (
        <p>
          Matching mission settings and repeatable pilot. Compare measured
          changes below.
        </p>
      )}
      <div className="comparison-stats">
        <span>
          Energy{' '}
          <strong>
            {num(a.outcome.energy, 2)} → {num(b.outcome.energy, 2)} Wh
          </strong>
        </span>
        <span>
          Stable hover command{' '}
          <strong>
            {num(
              a.outcome.hoverCommand === null
                ? NaN
                : a.outcome.hoverCommand * 100,
              1,
            )}{' '}
            →{' '}
            {num(
              b.outcome.hoverCommand === null
                ? NaN
                : b.outcome.hoverCommand * 100,
              1,
            )}
            %
          </strong>
        </span>
        <span>
          Configuration changes{' '}
          <strong>
            {c.differences.length
              ? c.differences
                  .map((d) => `${d.field}: ${d.from} → ${d.to}`)
                  .join(' · ')
              : 'Same components'}
          </strong>
        </span>
      </div>
      <small>
        Coral = selected run. Cyan = comparison. Hover/wind plots align the
        evaluation interval start; other missions align liftoff.
      </small>
    </section>
  );
}
function TelemetryPlots({ run, comparison: other, event }) {
  const chartGroups = [
    ['Altitude', 'm', ['altitude']],
    [
      ['hover', 'wind'].includes(run.metadata.missionId)
        ? 'Position error'
        : 'Distance to objective',
      'm',
      ['hover', 'wind'].includes(run.metadata.missionId)
        ? ['horizontal_error', 'vertical_error']
        : ['objective_horizontal_error', 'objective_vertical_error'],
    ],
    ['Ground speed', 'm/s', ['speed']],
    ['Attitude', '°', ['roll_deg', 'pitch_deg', 'yaw_deg']],
    ['Motor commands', '0–1', ['motor1', 'motor2', 'motor3', 'motor4']],
    ['Electrical power', 'W', ['power_W']],
    ['Battery state', 'fraction', ['battery']],
  ];
  const plotData = useMemo(() => {
    const offset = (r) =>
        r.intervals.hold?.[0] ??
        r.intervals.wind?.[0] ??
        r.events.find((e) => e.type === 'takeoff')?.t ??
        0,
      off = other ? offset(run) : 0,
      offB = other ? offset(other) : 0;
    const step = Math.max(1, Math.ceil(run.samples.length / 650));
    return run.samples
      .filter((s, i) => i % step === 0)
      .map((s) => {
        const row = { ...s, plotTime: s.t - off };
        if (other) {
          const ix = Math.round((row.plotTime + offB) / 0.02) - 1,
            b = other.samples[ix];
          if (b)
            for (const key of [
              'altitude',
              'horizontal_error',
              'vertical_error',
              'speed',
              'roll_deg',
              'pitch_deg',
              'yaw_deg',
              'motor1',
              'motor2',
              'motor3',
              'motor4',
              'power_W',
              'battery',
              'objective_horizontal_error',
              'objective_vertical_error',
            ])
              row['b_' + key] = b[key];
        }
        return row;
      });
  }, [run, other]);
  return (
    <div className="plots">
      {chartGroups.map(([title, unit, fields]) => (
        <section className="plot" key={title} id={'plot-' + fields[0]}>
          <div>
            <strong>{title}</strong>
            <small>{unit}</small>
          </div>
          <ChartContainer
            className="telemetry-chart"
            config={Object.fromEntries(
              fields.map((f, i) => [
                f,
                {
                  label: f.replaceAll('_', ' '),
                  color: ['#ff91ad', '#bda5ff', '#ffd380', '#f1f1ff'][i],
                },
              ]),
            )}
          >
            <LineChart
              data={plotData}
              syncId="flight-telemetry"
              margin={{ top: 12, right: 16, bottom: 2, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="#58405a"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="plotTime"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v) => Number(v).toFixed(0) + 's'}
                minTickGap={45}
              />
              <YAxis
                width={48}
                tickFormatter={(v) =>
                  Number(v).toFixed(Math.abs(v) > 10 ? 0 : 1)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => num(Number(v), 2) + ' s'}
                  />
                }
              />
              {fields.map((f, i) => (
                <Line
                  key={f}
                  dataKey={f}
                  type="linear"
                  stroke={['#ff91ad', '#bda5ff', '#ffd380', '#f1f1ff'][i]}
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {other && (
                <Line
                  dataKey={'b_' + fields[0]}
                  stroke="#68dff0"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 3"
                  isAnimationActive={false}
                />
              )}{' '}
              {!other &&
                event &&
                (event.start !== undefined ? (
                  <ReferenceArea
                    x1={event.start}
                    x2={event.end ?? event.t}
                    fill="#f4bd76"
                    fillOpacity={0.12}
                  />
                ) : (
                  <ReferenceLine
                    x={event.t}
                    stroke="#f4bd76"
                    strokeDasharray="3 2"
                  />
                ))}
            </LineChart>
          </ChartContainer>
        </section>
      ))}
    </div>
  );
}
