'use client';
/* oxlint-disable react/react-compiler */
// The map is an interactive keyboard-controlled canvas; these overlays announce loading state.
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, MapPin, Navigation, Pause, Play, RotateCcw, Map as MapIcon } from 'lucide-react';
import { CityFlight, CITIES, cityCoordinates, parseCoordinates } from '@/lib/city-flight.mjs';
import { DT, eulerFromQuaternion, clamp } from '@/lib/sim.mjs';
import './city-explorer.css';

export default function CityExplorer({ config, session, onGame, switchKey }) {
  const host = useRef(null), mapRef = useRef(null), keys = useRef(new Set()), touch = useRef({});
  const [location, setLocation] = useState(session.current?.location || CITIES[0]);
  const [status, setStatus] = useState('loading'), [message, setMessage] = useState('Loading real streets and buildings…');
  const [retry, setRetry] = useState(0), [view, setView] = useState('drone');
  const [coordinates, setCoordinates] = useState(''), [coordinateError, setCoordinateError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const viewRef = useRef(view), readyRef = useRef(false), look = useRef(-.22);
  viewRef.current = view;
  if (!session.current || JSON.stringify(session.current.config) !== JSON.stringify(config)) session.current = new CityFlight(config, location);

  useEffect(() => {
    const heldKeys = keys.current;
    let live = true, map, timer, frame, last = performance.now(), accumulator = 0, lastUI = 0, loaded = false;
    readyRef.current = false;
    setStatus('loading');
    setMessage('Loading real streets and buildings…');
    const fail = () => {
      if (!live) return;
      readyRef.current = false;
      const s = session.current;
      if (s.armed && !s.paused) s.pause();
      setStatus('error');
      setMessage('City maps could not load. Check your connection and retry, or return to Game.');
    };
    const draw = () => {
      if (!map || !loaded) return;
      const s = session.current, yaw = eulerFromQuaternion(s.q)[2];
      const eye = cityCoordinates(s.location, s.p), bearing = (90 - yaw * 180 / Math.PI + 360) % 360;
      if (viewRef.current === 'map') {
        map.jumpTo({ center: eye, zoom: 16.8, pitch: 48, bearing, elevation: 0 });
      } else {
        const target = cityCoordinates(s.location, [s.p[0] + Math.cos(yaw) * 50, s.p[1] + Math.sin(yaw) * 50]);
        map.jumpTo(map.calculateCameraOptionsFromTo(eye, Math.max(1.5, s.altitude), target, s.altitude + Math.tan(look.current) * 50));
      }
    };
    const loop = now => {
      const s = session.current;
      let elapsed = (now - last) / 1000;
      last = now;
      if (elapsed > .5 && s.armed && !s.paused) s.pause();
      elapsed = Math.min(elapsed, .1);
      const key = (p, n) => Number(keys.current.has(p)) - Number(keys.current.has(n));
      const gp = navigator.getGamepads?.()?.find(p => p?.connected);
      const axis = i => Math.abs(gp?.axes[i] || 0) > .15 ? gp.axes[i] : 0;
      if (readyRef.current && s.armed && !s.paused) {
        accumulator += elapsed;
        const input = {
          forward: clamp(key('KeyW', 'KeyS') + (touch.current.forward || 0) - axis(3), -1, 1),
          left: clamp(key('KeyA', 'KeyD') + (touch.current.left || 0) - axis(2), -1, 1),
          up: clamp(key('ArrowUp', 'ArrowDown') + (touch.current.up || 0) - axis(1), -1, 1),
          yaw: clamp(key('KeyQ', 'KeyE') + (touch.current.yaw || 0) - axis(0), -1, 1),
        };
        while (accumulator >= DT) { s.step(input); accumulator -= DT; }
      } else accumulator = 0;
      draw();
      if (now - lastUI > 100) {
        const geo = cityCoordinates(s.location, s.p);
        setSnapshot({ altitude: s.altitude, speed: s.speed, battery: s.battery, power: s.power, heading: (90 - eulerFromQuaternion(s.q)[2] * 180 / Math.PI + 360) % 360,
          lat: geo[1], lng: geo[0], paused: s.paused, status: s.status, reason: s.reason });
        lastUI = now;
      }
      frame = requestAnimationFrame(loop);
    };
    void (async () => {
      try {
        const { Map, setWorkerUrl } = await import('maplibre-gl');
        if (!live) return;
        setWorkerUrl('/map-worker-6.11.2/maplibre-gl-worker.mjs');
        map = new Map({ container: host.current, style: 'https://tiles.openfreemap.org/styles/liberty',
          center: [location.lng, location.lat], zoom: 16, pitch: 65, bearing: location.heading,
          interactive: false, centerClampedToGround: false, maxPitch: 89, canvasContextAttributes: { antialias: true }, attributionControl: { compact: false } });
        mapRef.current = map;
        map.getCanvas().setAttribute('aria-label', 'Real geographic city map with 3D buildings');
        map.on('error', () => { if (!loaded) fail(); else { setStatus('degraded'); setMessage('Some map tiles are unavailable. Retry to reload the city.'); } });
        map.on('load', () => {
          if (!live) return;
          loaded = true; clearTimeout(timer); readyRef.current = true;
          setStatus('ready'); setMessage('Real streets · 3D building outlines'); draw();
        });
        timer = setTimeout(fail, 25000);
        const resize = new ResizeObserver(() => map.resize());
        resize.observe(host.current);
        map.once('remove', () => resize.disconnect());
      } catch { fail(); }
    })();
    frame = requestAnimationFrame(loop);
    return () => {
      live = false; readyRef.current = false; clearTimeout(timer); cancelAnimationFrame(frame);
      heldKeys.clear(); touch.current = {};
      if (session.current.armed && !session.current.paused) session.current.pause();
      map?.remove(); mapRef.current = null;
    };
  }, [location, retry, session]);

  useEffect(() => {
    const clear = () => { keys.current.clear(); touch.current = {}; };
    const pause = () => { clear(); const s = session.current; if (s.armed && !s.paused) s.pause(); };
    const down = e => {
      if (e.target.closest('input,select,textarea,button,a,[role=tab],[role=dialog],[role=combobox]')) return;
      if (['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','KeyQ','KeyE'].includes(e.code)) { e.preventDefault(); keys.current.add(e.code); }
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); session.current.pause(); clear(); }
      if (e.code === switchKey && !e.repeat) onGame();
    };
    const up = e => keys.current.delete(e.code);
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden); };
  }, [session, onGame, switchKey]);
  const relocate = next => { keys.current.clear(); touch.current = {}; session.current = new CityFlight(config, next); setLocation(next); };
  const fly = () => {
    const s = session.current;
    if (!readyRef.current) return;
    if (s.status === 'ready') s.arm(); else s.pause();
    host.current?.focus();
  };
  const s = snapshot, flying = s && ['active','armed'].includes(s.status), ended = s && ['failed','incomplete','completed'].includes(s.status);
  const drag = useRef(null);
  return <section className="city-explorer" data-map-status={status}>
    <div className="city-toolbar">
      <div className="city-title"><span className="eyebrow">SIMULATOR / WORLD EXPLORER</span><h1>Take the city for a spin.</h1><p>Fly above real streets in your {config.name}.</p></div>
      <div className="city-mode" role="tablist" aria-label="Flight environment"><button role="tab" aria-selected={false} onClick={onGame}>Game</button><button role="tab" aria-selected={true}>Simulator</button></div>
    </div>
    <div className="city-location-bar">
      <label><MapPin size={17}/><span className="sr-only">City location</span><select aria-label="City location" value={location.id} onChange={e => relocate(CITIES.find(c => c.id === e.target.value))}>{CITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}{location.id === 'custom' && <option value="custom">Custom location</option>}</select></label>
      <form onSubmit={e => { e.preventDefault(); const next = parseCoordinates(coordinates); if (next) { setCoordinateError(''); relocate(next); } else setCoordinateError('Use latitude, longitude. Latitude must be −80 to 80; longitude −180 to 180.'); }}>
        <label className="sr-only" htmlFor="city-coordinates">Latitude, longitude</label><input id="city-coordinates" placeholder="Or enter latitude, longitude" value={coordinates} onChange={e => setCoordinates(e.target.value)} aria-invalid={!!coordinateError}/><button type="submit">Go</button>
      </form>
      <button className="city-view-toggle" onClick={() => setView(v => v === 'drone' ? 'map' : 'drone')}><MapIcon size={16}/>{view === 'drone' ? 'Map view' : 'Drone view'}</button>
    </div>
    {coordinateError && <p className="city-input-error" role="alert">{coordinateError}</p>}
    <div className="city-stage">
      <div ref={host} className="city-map" tabIndex={0} role="application" aria-label="City drone controls. W A S D move, arrows climb, Q E turn. Drag to look."
        onPointerDown={e => { host.current.focus(); drag.current = [e.clientX,e.clientY]; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (!drag.current) return; const dx = e.clientX - drag.current[0], dy = e.clientY - drag.current[1]; session.current.yawTarget -= dx * .004; look.current = clamp(look.current - dy * .004, -1.2, .12); drag.current = [e.clientX,e.clientY]; }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}/>
      <div className="city-map-label"><Navigation size={14}/> {view === 'drone' ? 'DRONE POV' : 'POSITION MAP'} <span>{s?.paused ? 'PAUSED' : flying ? 'FLYING' : 'PREVIEW'}</span></div>
      {view === 'drone' && <div className="city-crosshair" aria-hidden="true"><i/><span>{s?.heading.toFixed(0) || '0'}°</span></div>}
      {view === 'map' && <div className="city-map-pin" aria-hidden="true"><Navigation size={25}/></div>}
      {status === 'loading' && <div className="city-load-card" role="status"><MapPin size={28}/><h2>Bringing the city into view</h2><p>{message}</p></div>}
      {status === 'error' && <div className="city-load-card" role="alert"><h2>Map connection unavailable</h2><p>{message}</p><button onClick={() => setRetry(n => n + 1)}>Retry map</button><button onClick={onGame}>Back to Game</button></div>}
      {status === 'degraded' && <div className="city-tile-warning" role="status">{message} <button onClick={() => setRetry(n => n + 1)}>Retry map</button></div>}
      <div className="city-instruments" aria-label="City flight telemetry">
        <div><span>ALTITUDE</span><strong data-testid="city-altitude">{s?.altitude.toFixed(1) || location.altitude}<small> m</small></strong></div>
        <div><span>GROUND SPEED</span><strong>{s?.speed.toFixed(1) || '0.0'}<small> m/s</small></strong></div>
        <div><span>BATTERY</span><strong>{((s?.battery ?? 1)*100).toFixed(0)}<small> %</small></strong></div>
        <div><span>GPS POSITION</span><strong className="city-gps" data-testid="city-gps">{(s?.lat ?? location.lat).toFixed(6)}, {(s?.lng ?? location.lng).toFixed(6)}</strong></div>
      </div>
    </div>
    <div className="city-flight-bar">
      <button className="city-fly" disabled={!['ready','degraded'].includes(status) || !session.current.aircraft.valid || ended} onClick={fly}>{flying && !s.paused ? <Pause size={16}/> : <Play size={16}/>} {flying ? s.paused ? 'Resume city flight' : 'Pause city flight' : 'Fly the city'}</button>
      <button onClick={() => relocate({ ...location })}><RotateCcw size={15}/> Reset position</button>
      <span><kbd>W A S D</kbd> Move <kbd>↑ ↓</kbd> Altitude <kbd>Q E</kbd> Turn · Drag to look · Space to pause</span>
    </div>
    {(ended || !session.current.aircraft.valid) && <p role="alert" className="city-input-error">{ended ? s.reason : session.current.aircraft.errors.join(' ')}</p>}
    <div className="city-touch-controls" aria-label="Touch city flight controls">{[['Forward','forward',1,ArrowUp],['Back','forward',-1,ArrowDown],['Left','left',1,ArrowLeft],['Right','left',-1,ArrowRight],['Climb','up',1,ArrowUp],['Descend','up',-1,ArrowDown],['Turn left','yaw',1,RotateCcw],['Turn right','yaw',-1,Navigation]].map(([label,key,value,Icon]) => <button key={label} aria-label={label} onPointerDown={e => { touch.current[key] = value; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={() => { touch.current[key] = 0; }} onPointerCancel={() => { touch.current[key] = 0; }}><Icon size={16}/><small>{label}</small></button>)}</div>
    <p className="city-footnote">OpenFreeMap / OpenStreetMap streets and building shapes. Flat ground; buildings are visual and can be flown through. City flights use your aircraft physics without mission scoring. Game missions stay paused while you explore.</p>
  </section>;
}
