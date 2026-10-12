import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_DEFAULT_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL } from "./config";
import styles from "./MapView.module.css";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface MapViewProps {
  origin: MapPoint | null;
  radiusKm: number | null;
  /** Demo homes to mark (positions are SIMULATED). */
  homes?: MapPoint[];
  /** When set, a click on the map (or the "drop pin at centre" button) reports a point. */
  onPick?: (lat: number, lng: number) => void;
  height?: number;
  reducedMotion?: boolean;
}

const pinIcon = L.divIcon({ className: styles.pinWrap, html: `<span class="${styles.pin}"></span>`, iconSize: [26, 34], iconAnchor: [13, 32] });
const homeIcon = L.divIcon({ className: styles.pinWrap, html: `<span class="${styles.home}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] });

/**
 * Real interactive map (Leaflet + OpenStreetMap standard tiles, attribution shown, light use only).
 * The base map is real; the circle is a true geographic radius around the chosen origin; home
 * markers are SIMULATED demo positions and are labelled that way. If tiles cannot load, a notice says
 * so and everything else (origin, radius, counts) still works.
 */
export default function MapView({ origin, radiusKm, homes = [], onPick, height = 280, reducedMotion = false }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const shownRadius = useRef<number>(0);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [tileErrors, setTileErrors] = useState(0);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng], 11);
    const tiles = L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
    tiles.on("tileerror", () => setTileErrors((n) => n + 1));
    tiles.on("tileload", () => setTileErrors(0));
    tiles.addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pick.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
      circle.current = null;
    };
  }, []);

  // Origin, markers, radius circle.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    circle.current = null;
    if (origin) {
      L.marker([origin.lat, origin.lng], { icon: pinIcon, title: origin.label, keyboard: false }).addTo(g).bindTooltip(origin.label);
    }
    for (const h of homes) {
      L.marker([h.lat, h.lng], { icon: homeIcon, title: h.label, keyboard: false }).addTo(g).bindTooltip(h.label);
    }
    if (origin && radiusKm) {
      const c = L.circle([origin.lat, origin.lng], { radius: shownRadius.current * 1000 || radiusKm * 1000, color: "#b9f26b", weight: 2, fillColor: "#b9f26b", fillOpacity: 0.08 }).addTo(g);
      circle.current = c;
      const from = shownRadius.current || radiusKm;
      shownRadius.current = radiusKm;
      m.fitBounds(L.latLng(origin.lat, origin.lng).toBounds(radiusKm * 2000).pad(0.15), { animate: !reducedMotion });
      if (reducedMotion || from === radiusKm) {
        c.setRadius(radiusKm * 1000);
      } else {
        const t0 = performance.now();
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / 450);
          const e = 1 - Math.pow(1 - k, 3);
          c.setRadius((from + (radiusKm - from) * e) * 1000);
          if (k < 1 && circle.current === c) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    } else if (origin) {
      shownRadius.current = 0;
      m.setView([origin.lat, origin.lng], 14, { animate: !reducedMotion });
    }
  }, [origin, radiusKm, homes, reducedMotion]);

  const centre = () => {
    const c = map.current?.getCenter();
    if (c) pick.current?.(c.lat, c.lng);
  };

  return (
    <div className={styles.frame} style={{ height }}>
      <div ref={el} className={styles.map} data-testid="map" role="application" aria-label="Map. Use the arrow keys to move it, or the button below to drop a pin at its centre." />
      {tileErrors >= 3 && (
        <p className={styles.notice} role="status">Map tiles couldn’t load (you may be offline). Your destination, radius and results still work.</p>
      )}
      {onPick && (
        <button type="button" className={styles.centreBtn} onClick={centre}>
          Drop pin at map centre
        </button>
      )}
    </div>
  );
}
