import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Site, Reading, Alert } from '../types';

interface SiteMapProps {
  sites: Site[];
  selectedSiteId: number | null;
  onSelectSite: (siteId: number) => void;
  latestReadings: Record<number, Reading>;
  recentAlerts: Alert[];
}

function MapFocusController({ site }: { site: Site | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (site) {
      map.flyTo([site.latitude, site.longitude], 12, { duration: 1.5 });
    }
  }, [site, map]);
  return null;
}

function createCustomIcon(siteId: number, hasAlert: boolean, isSelected: boolean) {
  const color = hasAlert ? '#ef4444' : isSelected ? '#38bdf8' : '#10b981';
  const html = `
    <div style="
      width:36px;height:36px;border-radius:50%;
      background:${color};
      border:3px solid rgba(255,255,255,0.3);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:12px;
      box-shadow:0 0 12px ${color};
      animation: markerPulse 2s infinite;
    ">#${siteId}</div>
  `;
  return L.divIcon({ html, className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -22] });
}

export const SiteMap: React.FC<SiteMapProps> = ({
  sites, selectedSiteId, onSelectSite, latestReadings, recentAlerts,
}) => {
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const isSiteInAlert = (site: Site) => {
    const ids = new Set(site.sensors.map((s) => s.id));
    return recentAlerts.some((a) => ids.has(a.sensor_id));
  };

  return (
    <div className="map-wrapper">
      <div className="map-legend-bar">
        <span>🗺️ GIS Infrastructure Spatial Grid</span>
        <div className="map-legend">
          <span><span className="ldot" style={{ background: '#10b981' }}></span> Operational</span>
          <span><span className="ldot" style={{ background: '#ef4444' }}></span> Alert</span>
          <span><span className="ldot" style={{ background: '#38bdf8' }}></span> Selected</span>
        </div>
      </div>

      <MapContainer
        center={[45.0, 5.0]}
        zoom={3}
        scrollWheelZoom={true}
        className="leaflet-map-element"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {sites.map((site) => (
          <Marker
            key={site.id}
            position={[site.latitude, site.longitude]}
            icon={createCustomIcon(site.id, isSiteInAlert(site), site.id === selectedSiteId)}
            eventHandlers={{ click: () => onSelectSite(site.id) }}
          >
            <Popup>
              <div className="popup-card">
                <strong>{site.name}</strong>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 8px' }}>
                  {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                </p>
                {site.sensors.map((sensor) => {
                  const r = latestReadings[sensor.id];
                  return (
                    <div key={sensor.id} className="popup-sensor-row">
                      <span>#{sensor.id} {sensor.type}:</span>
                      <strong>{r ? `${r.value.toFixed(2)} ${sensor.unit}` : '—'}</strong>
                    </div>
                  );
                })}
                <button className="popup-select-btn" onClick={() => onSelectSite(site.id)}>
                  View Charts →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapFocusController site={selectedSite} />
      </MapContainer>
    </div>
  );
};
