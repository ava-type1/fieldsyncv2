import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, List, Map as MapIcon, Phone } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../../components/ui/Card';
import { useJobsStore } from '../../stores/jobsStore';
import type { Job } from '../../types';

// Fix Leaflet default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const statusColors: Record<string, string> = {
  active: '#3B82F6',
  in_progress: '#F59E0B',
  on_hold: '#F97316',
  completed: '#10B981',
};

const createMarkerIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

export function MapView() {
  const navigate = useNavigate();
  const jobs = useJobsStore(state => state.jobs);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const openInMaps = (job: Job) => {
    const address = `${job.street}, ${job.city}, ${job.state} ${job.zip}`;
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?q=${encodedAddress}`
      : `https://maps.google.com/?q=${encodedAddress}`;
    window.open(url, '_blank');
  };

  // Jobs with coordinates
  const mappableJobs = useMemo(() => jobs.filter(j => j.lat && j.lng), [jobs]);
  
  // Center on Ocala FL by default
  const mapCenter: [number, number] = mappableJobs.length > 0
    ? [
        mappableJobs.reduce((sum, j) => sum + (j.lat || 0), 0) / mappableJobs.length,
        mappableJobs.reduce((sum, j) => sum + (j.lng || 0), 0) / mappableJobs.length,
      ]
    : [29.1872, -82.1401];

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Map</h1>
          <p className="text-xs text-gray-500">{jobs.length} jobs · {mappableJobs.length} on map</p>
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'map' ? 'bg-gray-700 shadow text-blue-400' : 'text-gray-500'
            }`}
          >
            <MapIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-gray-700 shadow text-blue-400' : 'text-gray-500'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <>
          {mappableJobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center bg-gray-950">
              <MapPin className="w-12 h-12 text-gray-700 mb-4" />
              <h3 className="text-lg font-medium text-gray-300">No locations yet</h3>
              <p className="mt-1 text-gray-500 max-w-sm text-sm">
                Jobs need coordinates to show on the map. Addresses from scanned forms will appear here.
              </p>
              {jobs.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {jobs.length} job{jobs.length > 1 ? 's' : ''} without coordinates
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
                dragging={true}
                touchZoom={true}
                doubleClickZoom={true}
                boxZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mappableJobs.map((job) => (
                  <Marker
                    key={job.id}
                    position={[job.lat!, job.lng!]}
                    icon={createMarkerIcon(statusColors[job.status] || '#6B7280')}
                    eventHandlers={{
                      click: () => navigate(`/job/${job.id}`),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <h3 className="font-semibold text-base">{job.customerName}</h3>
                        {job.phone && (
                          <a href={`tel:${job.phone}`} className="text-sm text-blue-400 font-medium block mt-1">
                            📞 {job.phone}
                          </a>
                        )}
                        <p className="text-sm text-gray-400 mt-2">{job.street}</p>
                        <p className="text-sm text-gray-400">{job.city}, {job.state} {job.zip}</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => navigate(`/job/${job.id}`)}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-medium"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => openInMaps(job)}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded font-medium"
                          >
                            Navigate
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              
              <div className="absolute top-3 right-3 bg-gray-900/90 text-gray-300 px-3 py-1 rounded-full shadow text-sm font-medium z-[1000]">
                {mappableJobs.length} jobs
              </div>
            </div>
          )}
        </>
      ) : (
        /* List View */
        <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-950">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <MapPin className="w-12 h-12 text-gray-700 mb-4" />
              <h3 className="text-lg font-medium text-gray-300">No jobs yet</h3>
              <p className="mt-1 text-gray-500">Scan a work order to get started.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <Card key={job.id} onClick={() => navigate(`/job/${job.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-100 text-lg truncate">
                      {job.customerName}
                    </h3>
                    {job.phone && (
                      <a
                        href={`tel:${job.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 font-medium text-sm mt-1 block"
                      >
                        <Phone className="w-3.5 h-3.5 inline mr-1" />
                        {job.phone}
                      </a>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {job.street}, {job.city}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: statusColors[job.status] }}
                      />
                      <span className="text-xs text-gray-500 capitalize">
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openInMaps(job); }}
                    className="p-2 text-blue-400 hover:bg-gray-800 rounded-lg"
                  >
                    <Navigation className="w-5 h-5" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
