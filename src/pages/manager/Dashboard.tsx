import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PropertyCardSkeleton } from '../../components/ui/Skeleton';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Property, Customer, Phase } from '../../types';

interface PropertyWithRelations extends Property {
  customer: Customer;
  phases: Phase[];
}

type FilterTab = 'all' | 'pending' | 'in_progress' | 'completed';

const tabs: { key: FilterTab; label: string; icon: typeof Building2 }[] = [
  { key: 'all', label: 'All', icon: Building2 },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'in_progress', label: 'In Progress', icon: AlertCircle },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

const statusColors: Record<string, string> = {
  pending_delivery: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  on_hold: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { organization, isManager } = useAuthStore();
  const [properties, setProperties] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    if (!isManager()) {
      navigate('/');
      return;
    }

    async function fetchProperties() {
      if (!organization) return;

      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*),
            phases(*)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const transformed = (data || []).map((p) => ({
          id: p.id,
          street: p.street,
          city: p.city,
          state: p.state,
          zip: p.zip,
          customerId: p.customer_id,
          customer: p.customer
            ? {
                id: p.customer.id,
                organizationId: p.customer.organization_id,
                firstName: p.customer.first_name,
                lastName: p.customer.last_name,
                phone: p.customer.phone,
                email: p.customer.email,
                preferredContact: p.customer.preferred_contact,
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
          phases: (p.phases || []).map((ph: Record<string, unknown>) => ({
            id: ph.id,
            propertyId: ph.property_id,
            type: ph.type,
            status: ph.status,
            assignedUserId: ph.assigned_user_id,
          })),
        })) as PropertyWithRelations[];

        setProperties(transformed);
      } catch (err) {
        console.error('Error fetching properties:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [organization, isManager, navigate]);

  const filteredProperties = properties.filter((p) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending')
      return p.overallStatus === 'pending_delivery' || p.overallStatus === 'on_hold';
    if (activeTab === 'in_progress') return p.overallStatus === 'in_progress';
    if (activeTab === 'completed')
      return p.overallStatus === 'completed' || p.overallStatus === 'closed';
    return true;
  });

  // Count properties needing review (have completed walkthrough phases)
  const needsReviewCount = properties.filter((p) =>
    p.phases.some((ph) => ph.type === 'walkthrough' && ph.status === 'completed')
  ).length;

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <PropertyCardSkeleton />
        <PropertyCardSkeleton />
        <PropertyCardSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Stats */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-2xl font-bold text-gray-900">{properties.length}</p>
          <p className="text-sm text-gray-500">Total Properties</p>
        </Card>
        <Card className={needsReviewCount > 0 ? 'bg-yellow-50 border-yellow-200' : ''}>
          <p className="text-2xl font-bold text-gray-900">{needsReviewCount}</p>
          <p className="text-sm text-gray-500">Needs Review</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
              activeTab === key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Property List */}
      <div className="p-4 space-y-3">
        {filteredProperties.length === 0 ? (
          <Card className="text-center py-8 text-gray-500">
            No properties in this category.
          </Card>
        ) : (
          filteredProperties.map((property) => {
            const walkthroughPhase = property.phases.find((p) => p.type === 'walkthrough');
            const needsReview = walkthroughPhase?.status === 'completed';

            return (
              <Card
                key={property.id}
                onClick={() =>
                  needsReview
                    ? navigate(`/dashboard/review/${property.id}`)
                    : navigate(`/property/${property.id}`)
                }
                className={needsReview ? 'border-yellow-300 bg-yellow-50' : ''}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {property.customer.firstName} {property.customer.lastName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {property.street}, {property.city}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      statusColors[property.overallStatus] || 'bg-gray-100'
                    }`}
                  >
                    {property.overallStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                {needsReview && (
                  <div className="mt-3 pt-3 border-t border-yellow-200">
                    <span className="text-sm font-medium text-yellow-700">
                      Walk-through submitted - Review required
                    </span>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
