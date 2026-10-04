'use client';
/* oxlint-disable react/react-compiler */
// The map is an interactive keyboard-controlled canvas; these overlays announce loading state.
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, MapPin, Navigation, Pause, Play, RotateCcw, Map as MapIcon } from 'lucide-react';
import { CityFlight, CITIES, cityCoordinates, parseCoordinates, restoreCityFlight } from '@/lib/city-flight.mjs';
import { DT, eulerFromQuaternion, clamp } from '@/lib/sim.mjs';
import './city-explorer.css';

export default function CityExplorer({ config, session, onGame, switchKey }) {
  const host = useRef(null), mapRef = useRef(null), keys = useRef(new Set()), touch = useRef({});
  const [location, setLocation] = useState(session.current?.location || CITIES[0]);
  const [status, setStatus] = useState('loading'), [message, setMessage] = useState('Loading real streets and buildings…');
  const [retry, setRetry] = useState(0), [view, setView] = useState('drone');
  const [latitude, setLatitude] = useState(String(location.lat)), [longitude, setLongitude] = useState(String(location.lng));
  const [coordinateError, setCoordinateError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [choosing, setChoosing] = useState(false), [destination, setDestination] = useState(null), [jumpNotice, setJumpNotice] = useState('');
  const [canUndo, setCanUndo] = useState(!!session.current?.previousJump);
  const selectRef = useRef(null), destinationRef = useRef(null);
  destinationRef.current = destination;
  const viewRef = useRef(view), readyRef = useRef(false), look = useRef(-.22);
  viewRef.current = view;
  session.current = restoreCityFlight(session.current, config, location);

  useEffect(() => {
    const heldKeys = keys.current;
    let live = true, map, droneMarker, destinationMarker, cameraView, timer, frame, last = performance.now(), accumulator = 0, lastUI = 0, loaded = false;
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
      if (cameraView !== viewRef.current) {
        cameraView = viewRef.current;
        map.stop();
        for (const handler of [map.dragPan, map.scrollZoom, map.touchZoomRotate]) {
          if (cameraView === 'map') handler.enable(); else handler.disable();
        }
        map.touchZoomRotate.disableRotation();
        if (cameraView === 'map') map.jumpTo({ center: eye, zoom: 16.8, pitch: 48, bearing, elevation: 0 });
      }
      droneMarker.getElement().hidden = cameraView !== 'map';
      destinationMarker.getElement().hidden = cameraView !== 'map' || !destinationRef.current;
      if (viewRef.current === 'map') {
        droneMarker.setLngLat(eye).setRotation(bearing);
        if (destinationRef.current) destinationMarker.setLngLat(destinationRef.current);
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
        const { Map, Marker, setWorkerUrl } = await import('maplibre-gl');
        if (!live) return;
        setWorkerUrl('/map-worker-6.11.2/maplibre-gl-worker.mjs');
        map = new Map({ container: host.current, style: 'https://tiles.openfreemap.org/styles/liberty',
          center: [location.lng, location.lat], zoom: 16, pitch: 65, bearing: location.heading,
          interactive: false, centerClampedToGround: false, maxPitch: 89, canvasContextAttributes: { antialias: true }, attributionControl: { compact: false } });
        mapRef.current = map;
        const pin = document.createElement('div');
        pin.className = 'city-drone-marker'; pin.textContent = '↑'; pin.setAttribute('aria-label', 'Drone position');
        droneMarker = new Marker({ element: pin, rotationAlignment: 'map' }).setLngLat([location.lng, location.lat]).addTo(map);
        const targetPin = document.createElement('div');
        targetPin.className = 'city-destination-marker'; targetPin.textContent = '+'; targetPin.hidden = true;
        targetPin.setAttribute('aria-label', 'Teleport destination');
        destinationMarker = new Marker({ element: targetPin }).setLngLat([location.lng, location.lat]).addTo(map);
        map.on('click', e => selectRef.current?.(e.lngLat.toArray()));
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
      droneMarker?.remove(); destinationMarker?.remove(); map?.remove(); mapRef.current = null;
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
  const relocate = next => {
    keys.current.clear(); touch.current = {};
    setChoosing(false); setDestination(null); setJumpNotice(''); setCanUndo(false);
    session.current = new CityFlight(config, next);
    setLocation(next); setLatitude(String(next.lat)); setLongitude(String(next.lng)); setCoordinateError('');
  };
  const centreOnDrone = () => {
    const s = session.current;
    mapRef.current?.easeTo({ center: cityCoordinates(s.location, s.p), duration: 450 });
  };
  const jump = coordinates => {
    if (!readyRef.current || !session.current.teleport(coordinates)) {
      setJumpNotice('Choose a point within 5 km east/west and north/south of the starting location. Use latitude and longitude to explore another area.');
      return;
    }
    keys.current.clear(); touch.current = {}; drag.current = null;
    setChoosing(false); setDestination(null); setCanUndo(true);
    setJumpNotice('Teleported. Altitude, heading and battery kept.');
    centreOnDrone(); host.current?.focus();
  };
  selectRef.current = coordinates => {
    if (viewRef.current !== 'map' || !choosing || !readyRef.current) return;
    if (!session.current.canTeleport(coordinates)) {
      setDestination(null);
      setJumpNotice('Outside the local flight area. Choose a point within 5 km east/west and north/south of the starting location.');
    } else { setDestination(coordinates); setJumpNotice('Destination marked on the ground map. Your current flight altitude will be kept.'); }
  };
  const toggleView = () => {
    keys.current.clear(); touch.current = {}; drag.current = null;
    setChoosing(false); setDestination(null); setJumpNotice('');
    if (view === 'drone' && session.current.armed && !session.current.paused) session.current.pause();
    setView(v => v === 'drone' ? 'map' : 'drone');
  };
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
      <form aria-label="Go to coordinates" onSubmit={e => { e.preventDefault(); const next = parseCoordinates(`${latitude},${longitude}`); if (next) relocate(next); else setCoordinateError('Enter latitude from −80 to 80 and longitude from −180 to 180.'); }}>
        <label className="city-coordinate-field" htmlFor="city-latitude"><span>LATITUDE</span><input id="city-latitude" inputMode="decimal" autoComplete="off" spellCheck={false} value={latitude} onChange={e => { setLatitude(e.target.value); setCoordinateError(''); }} aria-invalid={!!coordinateError && !parseCoordinates(`${latitude},0`)} aria-describedby={coordinateError ? 'city-coordinate-error' : undefined}/></label>
        <label className="city-coordinate-field" htmlFor="city-longitude"><span>LONGITUDE</span><input id="city-longitude" inputMode="decimal" autoComplete="off" spellCheck={false} value={longitude} onChange={e => { setLongitude(e.target.value); setCoordinateError(''); }} aria-invalid={!!coordinateError && !parseCoordinates(`0,${longitude}`)} aria-describedby={coordinateError ? 'city-coordinate-error' : undefined}/></label>
        <button type="submit">Go</button>
      </form>
      <button className="city-view-toggle" onClick={toggleView}><MapIcon size={16}/>{view === 'drone' ? 'Map view' : 'Drone view'}</button>
    </div>
    {coordinateError && <p id="city-coordinate-error" className="city-input-error" role="alert">{coordinateError}</p>}
    {view === 'map' && <div className="city-map-tools" aria-label="Map navigation">
      <button disabled={!['ready','degraded'].includes(status) || ended} aria-pressed={choosing} onClick={() => { setChoosing(!choosing); setDestination(null); setJumpNotice(''); }}><MapPin size={16}/>{choosing ? 'Cancel teleport' : 'Teleport'}</button>
      <button disabled={!['ready','degraded'].includes(status)} onClick={centreOnDrone}><Navigation size={16}/>Centre on drone</button>
      <button disabled={!canUndo || ended || !['ready','degraded'].includes(status)} onClick={() => {
        if (session.current.undoTeleport()) {
          keys.current.clear(); touch.current = {}; setCanUndo(false); setChoosing(false); setDestination(null);
          setJumpNotice('Returned to the position before your last jump.'); centreOnDrone();
        }
      }}><RotateCcw size={16}/>Undo jump</button>
      <span>{choosing ? 'Click or tap the map to mark a destination.' : 'Drag to pan · Scroll or pinch to zoom · Middle-click to teleport'}</span>
      {destination && <div className="city-jump-confirm"><strong>{destination[1].toFixed(6)}, {destination[0].toFixed(6)}</strong><button className="city-jump-now" onClick={() => jump(destination)}>Jump here</button></div>}
      {jumpNotice && <p role="status">{jumpNotice}</p>}
    </div>}
    <div className="city-stage">
      <div ref={host} className={`city-map${choosing ? ' city-pick-destination' : ''}`} tabIndex={0} role="application" aria-label={view === 'map' ? 'City position map. Drag to pan, scroll to zoom, middle-click to teleport.' : 'City drone controls. W A S D move, arrows climb, Q E turn. Drag to look.'}
        onAuxClick={e => { if (e.button === 1) e.preventDefault(); }}
        onPointerDown={e => {
          if (e.target.closest('.maplibregl-control-container')) return;
          host.current.focus();
          if (view === 'map') {
            if (e.button === 1) {
              e.preventDefault();
              const bounds = host.current.getBoundingClientRect();
              const point = mapRef.current?.unproject([e.clientX - bounds.left, e.clientY - bounds.top]);
              if (point) jump(point.toArray());
            }
            return;
          }
          if (e.button !== 0) return;
          drag.current = [e.clientX,e.clientY]; e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => { if (!drag.current) return; const dx = e.clientX - drag.current[0], dy = e.clientY - drag.current[1]; session.current.yawTarget -= dx * .004; look.current = clamp(look.current - dy * .004, -1.2, .12); drag.current = [e.clientX,e.clientY]; }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}/>
      <div className="city-map-label"><Navigation size={14}/> {view === 'drone' ? 'DRONE POV' : 'POSITION MAP'} <span>{s?.paused ? 'PAUSED' : flying ? 'FLYING' : 'PREVIEW'}</span></div>
      {view === 'drone' && <div className="city-crosshair" aria-hidden="true"><i/><span>{s?.heading.toFixed(0) || '0'}°</span></div>}
      {status === 'loading' && <div className="city-load-card" role="status"><MapPin size={28}/><h2>Bringing the city into view</h2><p>{message}</p></div>}
      {status === 'error' && <div className="city-load-card" role="alert"><h2>Map connection unavailable</h2><p>{message}</p><button onClick={() => setRetry(n => n + 1)}>Retry map</button><button onClick={onGame}>Back to Game</button></div>}
      {status === 'degraded' && <div className="city-tile-warning" role="status">{message} <button onClick={() => setRetry(n => n + 1)}>Retry map</button></div>}
      <div className="city-instruments" aria-label="City flight telemetry">
        <div><span>ALTITUDE</span><strong data-testid="city-altitude">{s?.altitude.toFixed(1) || location.altitude}<small> m</small></strong></div>
        <div><span>GROUND SPEED</span><strong data-testid="city-speed">{s?.speed.toFixed(1) || '0.0'}<small> m/s</small></strong></div>
        <div><span>BATTERY</span><strong>{((s?.battery ?? 1)*100).toFixed(0)}<small> %</small></strong></div>
        <div><span>GPS POSITION</span><strong className="city-gps" data-testid="city-gps">{(s?.lat ?? location.lat).toFixed(6)}, {(s?.lng ?? location.lng).toFixed(6)}</strong></div>
      </div>
    </div>
    <div className="city-flight-bar">
      <button className="city-fly" disabled={!['ready','degraded'].includes(status) || !session.current.aircraft.valid || ended} onClick={fly}>{flying && !s.paused ? <Pause size={16}/> : <Play size={16}/>} {flying ? s.paused ? 'Resume city flight' : 'Pause city flight' : 'Fly the city'}</button>
      <button onClick={() => relocate({ ...location })}><RotateCcw size={15}/> Reset position</button>
      <span><kbd>W A S D</kbd> Move <kbd>↑ ↓</kbd> Altitude <kbd>Q E</kbd> Turn · {view === 'map' ? 'Drag to pan' : 'Drag to look'} · Space to pause</span>
    </div>
    {(ended || !session.current.aircraft.valid) && <p role="alert" className="city-input-error">{ended ? s.reason : session.current.aircraft.errors.join(' ')}</p>}
    <div className="city-touch-controls" aria-label="Touch city flight controls">{[['Forward','forward',1,ArrowUp],['Back','forward',-1,ArrowDown],['Left','left',1,ArrowLeft],['Right','left',-1,ArrowRight],['Climb','up',1,ArrowUp],['Descend','up',-1,ArrowDown],['Turn left','yaw',1,RotateCcw],['Turn right','yaw',-1,Navigation]].map(([label,key,value,Icon]) => <button key={label} aria-label={label} onPointerDown={e => { touch.current[key] = value; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={() => { touch.current[key] = 0; }} onPointerCancel={() => { touch.current[key] = 0; }}><Icon size={16}/><small>{label}</small></button>)}</div>
    <p className="city-footnote">OpenFreeMap / OpenStreetMap streets and building shapes. Flat ground; buildings are visual and can be flown through. City flights use your aircraft physics without mission scoring. Game missions stay paused while you explore.</p>
  </section>;
}
