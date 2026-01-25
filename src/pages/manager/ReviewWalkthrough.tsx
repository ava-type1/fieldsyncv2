import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import type { Property, Customer, Phase, Issue, Photo } from '../../types';

interface PropertyWithRelations extends Property {
  customer: Customer;
  phases: Phase[];
  issues: Issue[];
}

export function ReviewWalkthrough() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [managerNotes, setManagerNotes] = useState('');

  useEffect(() => {
    async function fetchProperty() {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*),
            phases(*),
            issues(*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        setProperty({
          id: data.id,
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          customerId: data.customer_id,
          customer: data.customer
            ? {
                id: data.customer.id,
                organizationId: data.customer.organization_id,
                firstName: data.customer.first_name,
                lastName: data.customer.last_name,
                phone: data.customer.phone,
                email: data.customer.email,
                preferredContact: data.customer.preferred_contact,
                createdAt: data.customer.created_at,
                updatedAt: data.customer.updated_at,
              }
            : null!,
          manufacturer: data.manufacturer,
          overallStatus: data.overall_status,
          dealershipId: data.dealership_id,
          createdByOrgId: data.created_by_org_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          phases: (data.phases || []).map((p: Record<string, unknown>) => ({
            id: p.id,
            propertyId: p.property_id,
            type: p.type,
            category: p.category,
            status: p.status,
            notes: p.notes,
            checklistItems: p.checklist_items || [],
            completedAt: p.completed_at,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })),
          issues: (data.issues || []).map((i: Record<string, unknown>) => ({
            id: i.id,
            propertyId: i.property_id,
            title: i.title,
            description: i.description,
            category: i.category,
            severity: i.severity,
            status: i.status,
            createdAt: i.created_at,
            updatedAt: i.updated_at,
          })),
        } as PropertyWithRelations);

        // Fetch photos
        const { data: photoData } = await supabase
          .from('photos')
          .select('*')
          .eq('property_id', id);

        if (photoData) {
          setPhotos(
            photoData.map((p) => ({
              id: p.id,
              propertyId: p.property_id,
              url: p.url,
              photoType: p.photo_type,
              caption: p.caption,
              takenAt: p.taken_at,
              createdAt: p.created_at,
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching property:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      // Update property status
      await supabase
        .from('properties')
        .update({ overall_status: 'in_progress' })
        .eq('id', id);

      // Create punch_list phase if issues exist
      if (property && property.issues.length > 0) {
        await supabase.from('phases').insert({
          property_id: id,
          type: 'punch_list',
          category: 'service',
          sort_order: 100,
          status: 'scheduled',
          notes: managerNotes || undefined,
        });
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Error approving walkthrough:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    setSubmitting(true);
    try {
      // Find walkthrough phase and set it back to in_progress
      const walkthroughPhase = property?.phases.find((p) => p.type === 'walkthrough');
      if (walkthroughPhase) {
        await supabase
          .from('phases')
          .update({
            status: 'in_progress',
            notes: managerNotes ? `Manager notes: ${managerNotes}` : undefined,
          })
          .eq('id', walkthroughPhase.id);
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Error requesting changes:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !property) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const walkthroughPhase = property.phases.find((p) => p.type === 'walkthrough');

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-600">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Review Walk-Through</h1>
        <p className="text-gray-600">
          {property.customer.firstName} {property.customer.lastName}
        </p>
        <p className="text-sm text-gray-500">
          {property.street}, {property.city}
        </p>
      </div>

      {/* Technician Notes */}
      {walkthroughPhase?.notes && (
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Technician Notes</h2>
          <Card>
            <p className="text-gray-700">{walkthroughPhase.notes}</p>
          </Card>
        </div>
      )}

      {/* Issues */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Issues Reported ({property.issues.length})
        </h2>
        {property.issues.length === 0 ? (
          <Card className="text-center py-6 text-gray-500">
            <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
            No issues reported
          </Card>
        ) : (
          <div className="space-y-3">
            {property.issues.map((issue) => (
              <Card key={issue.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{issue.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{issue.category}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      issue.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : issue.severity === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
                {issue.description && (
                  <p className="text-sm text-gray-600 mt-2">{issue.description}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Photos ({photos.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manager Notes */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Manager Notes</h2>
        <textarea
          value={managerNotes}
          onChange={(e) => setManagerNotes(e.target.value)}
          placeholder="Add notes or feedback..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={handleRequestChanges}
            loading={submitting}
          >
            <X className="w-4 h-4 mr-2" />
            Request Changes
          </Button>
          <Button fullWidth onClick={handleApprove} loading={submitting}>
            <Check className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
