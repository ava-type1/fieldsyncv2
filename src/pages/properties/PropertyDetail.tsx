import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Phone, MessageSquare, ChevronLeft, Play } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PropertyDetailSkeleton } from '../../components/ui/Skeleton';
import { PhaseTimeline } from '../../components/phases/PhaseTimeline';
import { supabase } from '../../lib/supabase';
import type { Property, Customer, Phase } from '../../types';

interface PropertyWithRelations extends Property {
  customer: Customer;
  phases: Phase[];
}

export function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperty() {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*),
            phases(*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        // Transform data
        const transformed: PropertyWithRelations = {
          id: data.id,
          street: data.street,
          unit: data.unit,
          city: data.city,
          state: data.state,
          zip: data.zip,
          county: data.county,
          lat: data.lat,
          lng: data.lng,
          customerId: data.customer_id,
          customer: data.customer ? {
            id: data.customer.id,
            organizationId: data.customer.organization_id,
            firstName: data.customer.first_name,
            lastName: data.customer.last_name,
            phone: data.customer.phone,
            email: data.customer.email,
            preferredContact: data.customer.preferred_contact,
            notes: data.customer.notes,
            createdAt: data.customer.created_at,
            updatedAt: data.customer.updated_at,
          } : null!,
          manufacturer: data.manufacturer,
          model: data.model,
          serialNumber: data.serial_number,
          overallStatus: data.overall_status,
          currentPhase: data.current_phase,
          dealershipId: data.dealership_id,
          createdByOrgId: data.created_by_org_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          phases: (data.phases || []).map((p: Record<string, unknown>) => ({
            id: p.id,
            propertyId: p.property_id,
            type: p.type,
            category: p.category,
            sortOrder: p.sort_order,
            status: p.status,
            assignedOrgId: p.assigned_org_id,
            assignedUserId: p.assigned_user_id,
            scheduledDate: p.scheduled_date,
            startedAt: p.started_at,
            completedAt: p.completed_at,
            notes: p.notes,
            checklistItems: p.checklist_items || [],
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })).sort((a: Phase, b: Phase) => a.sortOrder - b.sortOrder),
        };

        setProperty(transformed);
      } catch (err) {
        console.error('Error fetching property:', err);
        setError('Failed to load property');
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id]);

  if (loading) {
    return <PropertyDetailSkeleton />;
  }

  if (error || !property) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">
          {error || 'Property not found'}
        </div>
      </div>
    );
  }

  const address = `${property.street}, ${property.city}, ${property.state} ${property.zip}`;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;

  // Find current service phase (walkthrough or punch_list)
  const servicePhase = property.phases.find(
    (p) => p.category === 'service' && p.status !== 'completed' && p.status !== 'skipped'
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-600 mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900">
          {property.customer.firstName} {property.customer.lastName}
        </h1>

        {/* Address */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-2 text-primary-600"
        >
          <MapPin className="w-4 h-4" />
          <span className="text-sm">{address}</span>
        </a>

        {/* Contact buttons */}
        <div className="flex gap-3 mt-4">
          <a
            href={`tel:${property.customer.phone}`}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-700"
          >
            <Phone className="w-4 h-4" />
            Call
          </a>
          <a
            href={`sms:${property.customer.phone}`}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-700"
          >
            <MessageSquare className="w-4 h-4" />
            Text
          </a>
        </div>
      </div>

      {/* Service Action */}
      {servicePhase && (
        <div className="p-4">
          <Card className="bg-primary-50 border-primary-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-600 font-medium">
                  {servicePhase.type.replace(/_/g, ' ')}
                </p>
                <p className="text-primary-900 font-semibold mt-1">
                  {servicePhase.status === 'not_started' ? 'Ready to Start' : 'In Progress'}
                </p>
              </div>
              <Button
                onClick={() => navigate(`/property/${property.id}/walkthrough`)}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {servicePhase.status === 'not_started' ? 'Start' : 'Continue'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Timeline */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Phase Timeline</h2>
        <PhaseTimeline phases={property.phases} />
      </div>

      {/* Home Details */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Home Details</h2>
        <Card>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Manufacturer</dt>
              <dd className="text-gray-900 font-medium">{property.manufacturer}</dd>
            </div>
            {property.model && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Model</dt>
                <dd className="text-gray-900 font-medium">{property.model}</dd>
              </div>
            )}
            {property.serialNumber && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Serial #</dt>
                <dd className="text-gray-900 font-medium">{property.serialNumber}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}
