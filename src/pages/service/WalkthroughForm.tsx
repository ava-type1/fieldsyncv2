import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, AlertTriangle, Bell, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PhotoCapture } from '../../components/photos/PhotoCapture';
import { PhotoGrid } from '../../components/photos/PhotoGrid';
import { IssueForm } from '../../components/issues/IssueForm';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useNotifications } from '../../hooks/useNotifications';
import type { Phase, Issue, Photo, ChecklistItem, Property, Customer } from '../../types';

export function WalkthroughForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { sendWalkthroughScheduled, sendPhaseComplete } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  useEffect(() => {
    async function fetchPhase() {
      if (!id) return;

      try {
        // Fetch property with customer data for notifications
        const { data: propertyData } = await supabase
          .from('properties')
          .select(`*, customer:customers(*)`)
          .eq('id', id)
          .single();

        if (propertyData) {
          const transformedProperty: Property = {
            id: propertyData.id,
            street: propertyData.street,
            unit: propertyData.unit,
            city: propertyData.city,
            state: propertyData.state,
            zip: propertyData.zip,
            customerId: propertyData.customer_id,
            customer: propertyData.customer ? {
              id: propertyData.customer.id,
              organizationId: propertyData.customer.organization_id,
              firstName: propertyData.customer.first_name,
              lastName: propertyData.customer.last_name,
              phone: propertyData.customer.phone,
              email: propertyData.customer.email,
              preferredContact: propertyData.customer.preferred_contact,
              createdAt: propertyData.customer.created_at,
              updatedAt: propertyData.customer.updated_at,
            } : undefined,
            manufacturer: propertyData.manufacturer,
            overallStatus: propertyData.overall_status,
            dealershipId: propertyData.dealership_id,
            createdByOrgId: propertyData.created_by_org_id,
            createdAt: propertyData.created_at,
            updatedAt: propertyData.updated_at,
          };
          setProperty(transformedProperty);
        }

        // Fetch the walkthrough phase for this property
        const { data, error } = await supabase
          .from('phases')
          .select('*')
          .eq('property_id', id)
          .eq('type', 'walkthrough')
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setPhase({
            id: data.id,
            propertyId: data.property_id,
            type: data.type,
            category: data.category,
            sortOrder: data.sort_order,
            status: data.status,
            notes: data.notes,
            checklistItems: data.checklist_items || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          });
          setChecklistItems(data.checklist_items || []);
          setNotes(data.notes || '');
        }

        // Fetch existing photos for this property
        const { data: photoData } = await supabase
          .from('photos')
          .select('*')
          .eq('property_id', id);

        if (photoData) {
          setPhotos(
            photoData.map((p) => ({
              id: p.id,
              propertyId: p.property_id,
              phaseId: p.phase_id,
              issueId: p.issue_id,
              url: p.url,
              thumbnailUrl: p.thumbnail_url,
              caption: p.caption,
              photoType: p.photo_type,
              takenAt: p.taken_at,
              createdAt: p.created_at,
            }))
          );
        }

        // Fetch existing issues
        const { data: issueData } = await supabase
          .from('issues')
          .select('*')
          .eq('property_id', id);

        if (issueData) {
          setIssues(
            issueData.map((i) => ({
              id: i.id,
              propertyId: i.property_id,
              phaseId: i.phase_id,
              title: i.title,
              description: i.description,
              category: i.category,
              severity: i.severity,
              reportedByUserId: i.reported_by_user_id,
              reportedByOrgId: i.reported_by_org_id,
              status: i.status,
              createdAt: i.created_at,
              updatedAt: i.updated_at,
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching phase:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPhase();
  }, [id]);

  const handleChecklistToggle = (itemId: string) => {
    setChecklistItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, completed: !item.completed, completedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const handleAddIssue = (issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newIssue: Issue = {
      ...issue,
      id: `temp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setIssues((prev) => [...prev, newIssue]);
    setShowIssueForm(false);
  };

  const handlePhotoCapture = (photo: { id: string; localUri: string }) => {
    const newPhoto: Photo = {
      id: photo.id,
      propertyId: id!,
      url: photo.localUri,
      photoType: 'general',
      takenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };
    setPhotos((prev) => [...prev, newPhoto]);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      if (phase) {
        await supabase
          .from('phases')
          .update({
            status: 'in_progress',
            checklist_items: checklistItems,
            notes,
            started_at: phase.startedAt || new Date().toISOString(),
          })
          .eq('id', phase.id);
      }
      navigate(`/property/${id}`);
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Save phase as completed
      if (phase) {
        await supabase
          .from('phases')
          .update({
            status: 'completed',
            checklist_items: checklistItems,
            notes,
            completed_at: new Date().toISOString(),
            completed_by_user_id: user?.id,
          })
          .eq('id', phase.id);

        // Send phase complete notification
        if (property?.customer) {
          try {
            await sendPhaseComplete(property, phase);
            setNotificationSent(true);
          } catch (err) {
            console.error('Failed to send phase complete notification:', err);
          }
        }
      }

      // Save any new issues
      for (const issue of issues.filter((i) => i.id.startsWith('temp-'))) {
        await supabase.from('issues').insert({
          property_id: id,
          phase_id: phase?.id,
          title: issue.title,
          description: issue.description,
          category: issue.category,
          severity: issue.severity,
          reported_by_user_id: user?.id,
          reported_by_org_id: organization?.id,
          status: 'reported',
        });
      }

      navigate(`/property/${id}`);
    } catch (err) {
      console.error('Error submitting walkthrough:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-600">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-xl font-bold text-gray-900">Walk-Through</h1>
          {property?.customer?.phone && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Bell className="w-4 h-4" />
              <span>SMS enabled</span>
            </div>
          )}
        </div>
      </div>

      {/* Checklist Section */}
      {checklistItems.length > 0 && (
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Checklist</h2>
          <div className="space-y-2">
            {checklistItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleChecklistToggle(item.id)}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border text-left"
              >
                <div
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}
                >
                  {item.completed && <span className="text-white text-sm">✓</span>}
                </div>
                <span className={item.completed ? 'line-through text-gray-400' : 'text-gray-900'}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Issues Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Issues Found</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowIssueForm(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Issue
          </Button>
        </div>

        {issues.length === 0 ? (
          <Card className="text-center py-8 text-gray-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No issues reported yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
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

      {/* Photos Section */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
        <PhotoGrid
          photos={photos.map((p) => ({
            id: p.id,
            localUri: p.localUri,
            remoteUrl: p.url,
            syncStatus: p.syncStatus || 'synced',
          }))}
          onCapture={() => {}}
          onRemove={(photoId) => setPhotos((prev) => prev.filter((p) => p.id !== photoId))}
        />
        <PhotoCapture propertyId={id!} onCapture={handlePhotoCapture} />
      </div>

      {/* Notes Section */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes for Manager</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes for the manager..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          rows={4}
        />
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe">
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={handleSaveDraft} loading={saving}>
            Save Draft
          </Button>
          <Button fullWidth onClick={handleSubmit} loading={saving}>
            Submit
          </Button>
        </div>
      </div>

      {/* Issue Form Modal */}
      {showIssueForm && (
        <IssueForm
          propertyId={id!}
          onSubmit={handleAddIssue}
          onClose={() => setShowIssueForm(false)}
        />
      )}
    </div>
  );
}
