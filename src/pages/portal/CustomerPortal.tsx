import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Home,
  Calendar,
  Clock,
  Check,
  ChevronLeft,
  MapPin,
  Phone,
  Image as ImageIcon,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import type { Property, Customer, Phase, Photo, PhaseStatus } from '../../types';

interface PortalProperty extends Property {
  customer: Customer;
  phases: Phase[];
}

const statusConfig: Record<PhaseStatus, { label: string; color: string; bgColor: string }> = {
  completed: { label: 'Complete', color: 'text-green-700', bgColor: 'bg-green-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  scheduled: { label: 'Scheduled', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  not_started: { label: 'Upcoming', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  on_hold: { label: 'On Hold', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  blocked: { label: 'Delayed', color: 'text-red-700', bgColor: 'bg-red-100' },
  skipped: { label: 'Skipped', color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

const propertyStatusLabels: Record<string, { label: string; emoji: string }> = {
  pending_delivery: { label: 'Awaiting Delivery', emoji: '🚚' },
  in_progress: { label: 'Setup In Progress', emoji: '🔧' },
  on_hold: { label: 'Temporarily Paused', emoji: '⏸️' },
  completed: { label: 'Ready for Move-In!', emoji: '🎉' },
  warranty_active: { label: 'Under Warranty', emoji: '✅' },
  closed: { label: 'Complete', emoji: '🏠' },
};

function formatPhaseName(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function generatePortalCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0,O,I,1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function CustomerPortal() {
  const { code } = useParams<{ code: string }>();
  const [property, setProperty] = useState<PortalProperty | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (!code) return;

    async function fetchProperty() {
      setLoading(true);
      setError('');

      try {
        // Try to find by portal_code first, then by id
        let query = supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*),
            phases(*)
          `);

        // If code looks like a UUID, search by ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
        
        if (isUUID) {
          query = query.eq('id', code);
        } else {
          query = query.eq('portal_code', code.toUpperCase());
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError || !data) {
          setError('Property not found. Please check your code and try again.');
          setLoading(false);
          return;
        }

        // Transform the data
        const transformed: PortalProperty = {
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
          squareFootage: data.square_footage,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          sections: data.sections,
          soldDate: data.sold_date,
          deliveryDate: data.delivery_date,
          targetCompletionDate: data.target_completion_date,
          actualCompletionDate: data.actual_completion_date,
          moveInDate: data.move_in_date,
          currentPhase: data.current_phase,
          overallStatus: data.overall_status,
          dealershipId: data.dealership_id,
          createdByOrgId: data.created_by_org_id,
          portalCode: data.portal_code,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          phases: (data.phases || [])
            .map((ph: Record<string, unknown>) => ({
              id: ph.id as string,
              propertyId: ph.property_id as string,
              type: ph.type as Phase['type'],
              category: ph.category as Phase['category'],
              sortOrder: ph.sort_order as number,
              status: ph.status as Phase['status'],
              scheduledDate: ph.scheduled_date as string | undefined,
              completedAt: ph.completed_at as string | undefined,
              notes: ph.notes as string | undefined,
              checklistItems: (ph.checklist_items as Phase['checklistItems']) || [],
              createdAt: ph.created_at as string,
              updatedAt: ph.updated_at as string,
            }))
            .sort((a: Phase, b: Phase) => a.sortOrder - b.sortOrder),
        };

        setProperty(transformed);

        // If no portal code, generate one and save it
        if (!data.portal_code) {
          const newCode = generatePortalCode();
          await supabase
            .from('properties')
            .update({ portal_code: newCode })
            .eq('id', data.id);
        }

        // Fetch "after" photos only (no issue photos)
        const { data: photoData } = await supabase
          .from('photos')
          .select('*')
          .eq('property_id', data.id)
          .in('photo_type', ['after', 'general', 'inspection'])
          .is('issue_id', null)
          .order('taken_at', { ascending: false })
          .limit(20);

        if (photoData) {
          setPhotos(photoData.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            propertyId: p.property_id as string,
            phaseId: p.phase_id as string | undefined,
            url: p.url as string,
            thumbnailUrl: p.thumbnail_url as string | undefined,
            caption: p.caption as string | undefined,
            photoType: p.photo_type as Photo['photoType'],
            takenAt: p.taken_at as string,
            createdAt: p.created_at as string,
          })));
        }
      } catch (err) {
        console.error('Error fetching property:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your property...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Property Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/portal"
            className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Try again
          </Link>
        </Card>
      </div>
    );
  }

  const completedPhases = property.phases.filter((p) => p.status === 'completed').length;
  const totalPhases = property.phases.filter((p) => p.status !== 'skipped').length;
  const progressPercent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
  const statusInfo = propertyStatusLabels[property.overallStatus] || { label: property.overallStatus, emoji: '🏠' };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-primary-600 text-white">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Link
            to="/portal"
            className="inline-flex items-center text-white/80 hover:text-white text-sm mb-3"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to search
          </Link>
          <h1 className="text-lg font-semibold">Your Property Status</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Property info card */}
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Home className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900">{property.street}</h2>
              {property.unit && <p className="text-sm text-gray-600">Unit {property.unit}</p>}
              <p className="text-sm text-gray-600">
                {property.city}, {property.state} {property.zip}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <MapPin className="w-4 h-4" />
            <span>{property.manufacturer} {property.model && `• ${property.model}`}</span>
          </div>

          {property.customer && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>
                {property.customer.firstName} {property.customer.lastName}
              </span>
            </div>
          )}
        </Card>

        {/* Status banner */}
        <Card className={`
          ${property.overallStatus === 'completed' ? 'bg-green-50 border-green-200' : ''}
          ${property.overallStatus === 'in_progress' ? 'bg-blue-50 border-blue-200' : ''}
        `}>
          <div className="text-center py-2">
            <span className="text-3xl mb-2 block">{statusInfo.emoji}</span>
            <h3 className="font-bold text-lg text-gray-900">{statusInfo.label}</h3>
            {property.targetCompletionDate && property.overallStatus !== 'completed' && (
              <p className="text-sm text-gray-600 mt-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Target: {formatDate(property.targetCompletionDate)}
              </p>
            )}
          </div>
        </Card>

        {/* Progress bar */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900">Overall Progress</span>
            <span className="text-primary-600 font-bold">{progressPercent}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {completedPhases} of {totalPhases} phases complete
          </p>
        </Card>

        {/* Timeline */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Setup Timeline</h3>
          <div className="space-y-4">
            {property.phases
              .filter((phase) => phase.status !== 'skipped')
              .map((phase, index, arr) => {
                const config = statusConfig[phase.status];
                const isCompleted = phase.status === 'completed';
                const isLast = index === arr.length - 1;

                return (
                  <div key={phase.id} className="relative flex gap-3">
                    {/* Timeline connector */}
                    {!isLast && (
                      <div
                        className={`absolute left-3.5 top-7 w-0.5 h-full ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`
                        relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                        ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                      `}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : phase.status === 'in_progress' ? (
                        <Clock className="w-4 h-4 text-gray-600" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{formatPhaseName(phase.type)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      {phase.completedAt && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Completed {formatDate(phase.completedAt)}
                        </p>
                      )}
                      {!phase.completedAt && phase.scheduledDate && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Scheduled for {formatDate(phase.scheduledDate)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Photo gallery */}
        {photos.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Progress Photos</h3>
              <span className="text-sm text-gray-500">{photos.length} photos</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.caption || 'Property photo'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </Card>
        )}

        {photos.length === 0 && (
          <Card className="text-center py-6">
            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Photos will appear here as work progresses</p>
          </Card>
        )}

        {/* Key dates */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Key Dates</h3>
          <div className="space-y-2 text-sm">
            {property.deliveryDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Home Delivered</span>
                <span className="font-medium">{formatDate(property.deliveryDate)}</span>
              </div>
            )}
            {property.targetCompletionDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Target Completion</span>
                <span className="font-medium">{formatDate(property.targetCompletionDate)}</span>
              </div>
            )}
            {property.actualCompletionDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Actual Completion</span>
                <span className="font-medium text-green-600">{formatDate(property.actualCompletionDate)}</span>
              </div>
            )}
            {property.moveInDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Move-In Date</span>
                <span className="font-medium text-primary-600">{formatDate(property.moveInDate)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Reassurance message */}
        <div className="bg-primary-50 rounded-xl p-4 text-center">
          <p className="text-primary-800 text-sm">
            🏠 Your new home is being set up with care. We'll keep this page updated as work progresses.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 py-3">
        <p className="text-center text-xs text-gray-400">
          Powered by FieldSync • Last updated {formatDate(property.updatedAt)}
        </p>
      </footer>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.caption || 'Property photo'}
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedPhoto.caption && (
            <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
              {selectedPhoto.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
