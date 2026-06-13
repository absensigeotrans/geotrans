'use client';

import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix marker icons
const officeIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// A custom pulsing dot icon or green marker for user position
const userIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div class="relative flex items-center justify-center">
      <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-4.5 w-4.5 bg-blue-600 border-2 border-white shadow-md"></span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface EmployeeMapProps {
  officeLat: number;
  officeLng: number;
  userLat?: number;
  userLng?: number;
  radius: number;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<{ lat: number; lng: number }>({ lat, lng });

  useEffect(() => {
    const prev = prevRef.current;
    if (prev.lat !== lat || prev.lng !== lng) {
      map.panTo([lat, lng]);
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);

  return null;
}

export default function EmployeeMap({ officeLat, officeLng, userLat, userLng, radius }: EmployeeMapProps) {
  const officeCenter: [number, number] = [officeLat, officeLng];
  const userPosition: [number, number] | null = userLat && userLng ? [userLat, userLng] : null;

  // Center on user if available, otherwise office
  const mapCenter = userPosition || officeCenter;

  return (
    <div className="h-[220px] rounded-2xl overflow-hidden border border-gray-800 shadow-inner relative z-10">
      <MapContainer center={mapCenter} zoom={16} className="h-full w-full" scrollWheelZoom={true} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Office Marker */}
        <Marker position={officeCenter} icon={officeIcon} />
        
        {/* Geofence Circle */}
        <Circle
          center={officeCenter}
          radius={radius}
          pathOptions={{
            color: '#0A57A4',
            fillColor: '#0A57A4',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '4, 4'
          }}
        />

        {/* User Marker */}
        {userPosition && (
          <>
            <Marker position={userPosition} icon={userIcon} />
            <RecenterMap lat={userPosition[0]} lng={userPosition[1]} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
