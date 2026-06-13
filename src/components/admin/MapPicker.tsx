'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon path issue in bundlers
const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapPickerProps {
  latitude: number;
  longitude: number;
  radius: number;
  onPositionChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
}

function LocationMarker({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  const markerRef = useRef<L.Marker>(null);

  const handleDrag = useCallback((e: L.LeafletEvent) => {
    const marker = e.target as L.Marker;
    const pos = marker.getLatLng();
    onMove(pos.lat, pos.lng);
  }, [onMove]);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={iconDefault}
      draggable={true}
      eventHandlers={{ dragend: handleDrag }}
    />
  );
}

function FlyToCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef<{ lat: number; lng: number }>({ lat, lng });

  useEffect(() => {
    const prev = prevRef.current;
    if (prev.lat !== lat || prev.lng !== lng) {
      map.flyTo([lat, lng], map.getZoom(), { duration: 0.8 });
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);

  return null;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function MapPicker({ latitude, longitude, radius, onPositionChange, onRadiusChange }: MapPickerProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=id`
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  }, []);

  const selectResult = useCallback((r: NominatimResult) => {
    onPositionChange(parseFloat(r.lat), parseFloat(r.lon));
    setSearch(r.display_name);
    setShowResults(false);
    setResults([]);
    onRadiusChange(radius); // keep current radius
  }, [onPositionChange, onRadiusChange, radius]);

  const center: [number, number] = [latitude, longitude];

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Cari alamat atau tempat..."
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <span className="absolute right-3 top-2.5 w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        )}
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-[9999] max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-[300px] rounded-lg overflow-hidden border">
        <MapContainer center={center} zoom={16} className="h-full w-full" scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker lat={latitude} lng={longitude} onMove={onPositionChange} />
          <Circle center={center} radius={radius} pathOptions={{ color: '#0A57A4', fillOpacity: 0.1 }} />
          <FlyToCenter lat={latitude} lng={longitude} />
        </MapContainer>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </span>
        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
          Radius: {radius}m
        </span>
      </div>

      {/* Radius slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 w-12">Radius</span>
        <input
          type="range"
          min="10"
          max="1000"
          step="10"
          value={radius}
          onChange={(e) => onRadiusChange(parseInt(e.target.value))}
          className="flex-1 accent-blue-600"
        />
        <span className="text-xs font-mono w-16 text-right text-gray-700">{radius}m</span>
      </div>
    </div>
  );
}
