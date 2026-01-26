import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, ChevronRight, Plus, ScanLine } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PropertyCardSkeleton } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import type { Property, Customer } from '../../types';

interface PropertyWithCustomer extends Property {
  customer: Customer;
}

const statusColors: Record<string, string> = {
  pending_delivery: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  on_hold: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  warranty_active: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

export function PropertyList() {
  const navigate = useNavigate();
  const { organization } = useAuthStore();
  const [properties, setProperties] = useState<PropertyWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform the data to match our types
        const transformed = (data || []).map((p) => ({
          id: p.id,
          street: p.street,
          unit: p.unit,
          city: p.city,
          state: p.state,
          zip: p.zip,
          county: p.county,
          lat: p.lat,
          lng: p.lng,
          customerId: p.customer_id,
          customer: p.customer ? {
            id: p.customer.id,
            organizationId: p.customer.organization_id,
            firstName: p.customer.first_name,
            lastName: p.customer.last_name,
            phone: p.customer.phone,
            email: p.customer.email,
            preferredContact: p.customer.preferred_contact,
            notes: p.customer.notes,
            createdAt: p.customer.created_at,
            updatedAt: p.customer.updated_at,
          } : null,
          manufacturer: p.manufacturer,
          model: p.model,
          serialNumber: p.serial_number,
          overallStatus: p.overall_status,
          currentPhase: p.current_phase,
          dealershipId: p.dealership_id,
          createdByOrgId: p.created_by_org_id,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })) as PropertyWithCustomer[];

        setProperties(transformed);
      } catch (err) {
        console.error('Error fetching properties:', err);
        setError('Failed to load properties');
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [organization]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <PropertyCardSkeleton />
        <PropertyCardSkeleton />
        <PropertyCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No properties yet</h3>
          <p className="mt-1 text-gray-500 mb-6">Start by scanning a work order or adding manually.</p>
          <Button onClick={() => navigate('/quick-start')} className="gap-2">
            <ScanLine className="w-5 h-5" />
            Scan Work Order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Add New Button */}
      <button
        onClick={() => navigate('/quick-start')}
        className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-600 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Add New Property</span>
      </button>

      {properties.map((property) => (
        <Card
          key={property.id}
          onClick={() => navigate(`/property/${property.id}`)}
          className="relative"
        >
          {/* Customer Name */}
          <h3 className="font-semibold text-gray-900 text-lg">
            {property.customer
              ? `${property.customer.firstName} ${property.customer.lastName}`
              : 'Unknown Customer'}
          </h3>

          {/* Address */}
          <div className="flex items-center gap-2 mt-2 text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm truncate">
              {property.street}, {property.city}
            </span>
          </div>

          {/* Phone */}
          {property.customer?.phone && (
            <div className="flex items-center gap-2 mt-1 text-gray-600">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <a
                href={`tel:${property.customer.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-primary-600"
              >
                {property.customer.phone}
              </a>
            </div>
          )}

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                statusColors[property.overallStatus] || 'bg-gray-100'
              }`}
            >
              {property.overallStatus.replace(/_/g, ' ')}
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>
      ))}
    </div>
  );
}
