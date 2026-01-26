import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, List, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Property, Customer } from '../../types';

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

interface PropertyWithCustomer extends Property {
  customer: Customer;
}

const statusColors: Record<string, string> = {
  pending_delivery: '#6B7280',
  in_progress: '#F59E0B',
  on_hold: '#F97316',
  completed: '#10B981',
  warranty_active: '#3B82F6',
};

// Custom marker icons by status
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
  const { organization } = useAuthStore();
  const [properties, setProperties] = useState<PropertyWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    async function fetchProperties() {
      if (!organization) return;

      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*)
          `);

        if (error) throw error;

        const transformed = (data || []).map((p) => ({
          id: p.id,
          street: p.street,
          city: p.city,
          state: p.state,
          zip: p.zip,
          lat: p.lat,
          lng: p.lng,
          customerId: p.customer_id,
          customer: p.customer
            ? {
                id: p.customer.id,
                organizationId: p.customer.organization_id,
                firstName: p.customer.first_name,
                lastName: p.customer.last_name,
                phone: p.customer.phone,
                createdAt: p.customer.created_at,
                updatedAt: p.customer.updated_at,
              }
            : null!,
          manufacturer: p.manufacturer,
          overallStatus: p.overall_status,
          dealershipId: p.dealership_id,
          createdByOrgId: p.created_by_org_id,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })) as PropertyWithCustomer[];

        setProperties(transformed);
      } catch (err) {
        console.error('Error fetching properties:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [organization]);

  const openInMaps = (property: PropertyWithCustomer) => {
    const address = `${property.street}, ${property.city}, ${property.state} ${property.zip}`;
    const encodedAddress = encodeURIComponent(address);
    
    // Detect iOS (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Use Apple Maps on iOS, Google Maps elsewhere
    const url = isIOS 
      ? `maps://maps.apple.com/?q=${encodedAddress}`
      : `https://maps.google.com/?q=${encodedAddress}`;
    
    window.open(url, '_blank');
  };

  // Properties with coordinates for map
  const mappableProperties = properties.filter(p => p.lat && p.lng);
  
  // Calculate map center (default to Ocala, FL if no properties)
  const mapCenter: [number, number] = mappableProperties.length > 0
    ? [
        mappableProperties.reduce((sum, p) => sum + (p.lat || 0), 0) / mappableProperties.length,
        mappableProperties.reduce((sum, p) => sum + (p.lng || 0), 0) / mappableProperties.length,
      ]
    : [29.1872, -82.1401]; // Ocala, FL

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Map</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'map' ? 'bg-white shadow text-primary-600' : 'text-gray-500'
            }`}
          >
            <MapIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-white shadow text-primary-600' : 'text-gray-500'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <>
          {mappableProperties.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center bg-gray-50">
              <MapPin className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No locations yet</h3>
              <p className="mt-1 text-gray-500 max-w-sm">
                Properties need coordinates to show on the map. Add lat/lng when creating properties.
              </p>
              {properties.length > 0 && (
                <p className="mt-2 text-sm text-gray-400">
                  {properties.length} properties without coordinates
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 relative">
              <MapContainer
                center={mapCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mappableProperties.map((property) => (
                  <Marker
                    key={property.id}
                    position={[property.lat!, property.lng!]}
                    icon={createMarkerIcon(statusColors[property.overallStatus] || '#6B7280')}
                    eventHandlers={{
                      click: () => navigate(`/property/${property.id}`),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[220px]">
                        <h3 className="font-semibold text-base">
                          {property.customer?.firstName} {property.customer?.lastName}
                        </h3>
                        {property.customer?.phone && (
                          <a 
                            href={`tel:${property.customer.phone}`}
                            className="text-sm text-primary-600 font-medium block mt-1"
                          >
                            📞 {property.customer.phone}
                          </a>
                        )}
                        <p className="text-sm text-gray-600 mt-2">{property.street}</p>
                        <p className="text-sm text-gray-600">{property.city}, {property.state} {property.zip}</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => navigate(`/property/${property.id}`)}
                            className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded font-medium"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => openInMaps(property)}
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
              
              {/* Property count badge */}
              <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full shadow text-sm font-medium z-[1000]">
                {mappableProperties.length} properties
              </div>
            </div>
          )}
        </>
      ) : (
        /* List View */
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <MapPin className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No properties yet</h3>
              <p className="mt-1 text-gray-500">Properties will appear here.</p>
            </div>
          ) : (
            properties.map((property) => (
              <Card key={property.id} onClick={() => navigate(`/property/${property.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {property.customer?.firstName} {property.customer?.lastName}
                    </h3>
                    {property.customer?.phone && (
                      <a
                        href={`tel:${property.customer.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-600 font-medium text-sm mt-1 block"
                      >
                        📞 {property.customer.phone}
                      </a>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {property.street}, {property.city}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: statusColors[property.overallStatus] }}
                      />
                      <span className="text-xs text-gray-500">
                        {property.overallStatus.replace(/_/g, ' ')}
                      </span>
                      {!property.lat && (
                        <span className="text-xs text-orange-500">No location</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openInMaps(property);
                    }}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
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
