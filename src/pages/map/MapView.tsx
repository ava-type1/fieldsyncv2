import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, List } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Property, Customer } from '../../types';

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

export function MapView() {
  const navigate = useNavigate();
  const { organization } = useAuthStore();
  const [properties, setProperties] = useState<PropertyWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    async function fetchProperties() {
      if (!organization) return;

      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*)
          `)
          .not('lat', 'is', null)
          .not('lng', 'is', null);

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

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show list view if no map token or always for now (map integration is complex)
  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Map</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${
              viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-500'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded-lg ${
              viewMode === 'map' ? 'bg-primary-100 text-primary-600' : 'text-gray-500'
            }`}
            disabled={!mapboxToken}
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!mapboxToken && (
        <div className="p-4">
          <Card className="bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-700">
              Add a VITE_MAPBOX_TOKEN to .env.local to enable the interactive map view.
            </p>
          </Card>
        </div>
      )}

      {properties.length === 0 ? (
        <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] text-center">
          <MapPin className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No properties with locations</h3>
          <p className="mt-1 text-gray-500">
            Properties with addresses will appear here.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {properties.map((property) => (
            <Card key={property.id} onClick={() => navigate(`/property/${property.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {property.customer?.firstName} {property.customer?.lastName}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
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
          ))}
        </div>
      )}
    </div>
  );
}
