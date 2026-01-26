import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  AlertCircle, 
  Camera,
  X,
  Save
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SignatureCapture } from '../../components/signatures/SignatureCapture';
import { PhotoCapture } from '../../components/photos/PhotoCapture';
import { walkthroughChecklist, type ItemStatus, type ChecklistItemResult } from '../../data/walkthroughChecklist';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export function WalkthroughChecklist() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [results, setResults] = useState<Record<string, ChecklistItemResult>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState<string | null>(null);
  const [property, setProperty] = useState<{ customer: { firstName: string; lastName: string } } | null>(null);

  const currentRoom = walkthroughChecklist[currentRoomIndex];
  const totalRooms = walkthroughChecklist.length;
  const progress = ((currentRoomIndex + 1) / totalRooms) * 100;

  // Load property info
  useEffect(() => {
    async function loadProperty() {
      if (!propertyId) return;
      const { data } = await supabase
        .from('properties')
        .select('*, customer:customers(*)')
        .eq('id', propertyId)
        .single();
      if (data) {
        setProperty({
          customer: {
            firstName: data.customer?.first_name || '',
            lastName: data.customer?.last_name || '',
          }
        });
      }
    }
    loadProperty();
  }, [propertyId]);

  const setItemStatus = (itemId: string, status: ItemStatus) => {
    setResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        status,
      }
    }));
  };

  const setItemNotes = (itemId: string, notes: string) => {
    setResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        status: prev[itemId]?.status || 'issue',
        notes,
      }
    }));
  };

  const addItemPhoto = (itemId: string, photoUrl: string) => {
    setResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        status: prev[itemId]?.status || 'issue',
        photoIds: [...(prev[itemId]?.photoIds || []), photoUrl],
      }
    }));
    setShowCamera(null);
  };

  const getItemStatus = (itemId: string): ItemStatus => {
    return results[itemId]?.status || 'pending';
  };

  const getRoomProgress = (roomIndex: number) => {
    const room = walkthroughChecklist[roomIndex];
    const completed = room.items.filter(item => 
      results[item.id]?.status === 'ok' || results[item.id]?.status === 'issue'
    ).length;
    return { completed, total: room.items.length };
  };

  const currentRoomProgress = getRoomProgress(currentRoomIndex);
  
  const issueCount = Object.values(results).filter(r => r.status === 'issue').length;

  const handleSave = async () => {
    if (!propertyId || !user) return;
    
    setSaving(true);
    try {
      // Save walkthrough results to phases table or a new walkthrough_results table
      // For now, we'll update the phase status and store results in notes
      
      const issueItems = Object.values(results)
        .filter(r => r.status === 'issue')
        .map(r => {
          const room = walkthroughChecklist.find(room => 
            room.items.some(item => item.id === r.itemId)
          );
          const item = room?.items.find(i => i.id === r.itemId);
          return `${room?.name} - ${item?.label}: ${r.notes || 'Issue noted'}`;
        });

      // Update the walkthrough phase
      const { error } = await supabase
        .from('phases')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by_user_id: user.id,
          notes: issueItems.length > 0 
            ? `Issues found:\n${issueItems.join('\n')}`
            : 'Walk-through complete. No issues found.',
          customer_signature_url: customerSignature,
          customer_signed_at: customerSignature ? new Date().toISOString() : null,
        })
        .eq('property_id', propertyId)
        .eq('type', 'Initial Walk-Through');

      if (error) throw error;

      // Create return work orders for issues
      if (issueItems.length > 0) {
        await supabase
          .from('phases')
          .update({
            status: 'scheduled',
            notes: `Return visit needed for ${issueCount} issues from walk-through.`,
          })
          .eq('property_id', propertyId)
          .eq('type', 'Return Work Order #1');
      }

      navigate(`/property/${propertyId}`);
    } catch (error) {
      console.error('Error saving walkthrough:', error);
      alert('Failed to save walkthrough. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (showSignature) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Signature</h2>
          <p className="text-gray-600 mb-4">
            By signing below, {property?.customer.firstName} {property?.customer.lastName} acknowledges 
            completion of the walk-through inspection.
          </p>
          
          <SignatureCapture
            onSave={(signature) => {
              setCustomerSignature(signature);
              setShowSignature(false);
            }}
            onCancel={() => setShowSignature(false)}
          />
        </div>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="min-h-screen bg-black">
        <PhotoCapture
          onCapture={(photoUrl) => addItemPhoto(showCamera, photoUrl)}
          onClose={() => setShowCamera(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <span className="text-sm text-gray-500">
              Room {currentRoomIndex + 1} of {totalRooms}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Room Title */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{currentRoom.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {currentRoomProgress.completed} of {currentRoomProgress.total} items checked
        </p>
      </div>

      {/* Checklist Items */}
      <div className="p-4 space-y-2">
        {currentRoom.items.map((item) => {
          const status = getItemStatus(item.id);
          const isExpanded = expandedItem === item.id;
          const result = results[item.id];

          return (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex items-center gap-3">
                {/* Status buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setItemStatus(item.id, 'ok')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'ok'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setItemStatus(item.id, 'issue');
                      setExpandedItem(item.id);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'issue'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
                    }`}
                  >
                    <AlertCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Label */}
                <span 
                  className={`flex-1 ${status === 'ok' ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                  onClick={() => status === 'issue' && setExpandedItem(isExpanded ? null : item.id)}
                >
                  {item.label}
                </span>

                {/* Photo indicator */}
                {result?.photoIds && result.photoIds.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {result.photoIds.length} 📷
                  </span>
                )}
              </div>

              {/* Expanded issue details */}
              {isExpanded && status === 'issue' && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <textarea
                    placeholder="Describe the issue..."
                    className="w-full p-3 border rounded-lg text-sm resize-none"
                    rows={2}
                    value={result?.notes || ''}
                    onChange={(e) => setItemNotes(item.id, e.target.value)}
                  />
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCamera(item.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700"
                    >
                      <Camera className="w-4 h-4" />
                      Add Photo
                    </button>
                    <button
                      onClick={() => setExpandedItem(null)}
                      className="px-3 py-2 text-sm text-gray-500"
                    >
                      Done
                    </button>
                  </div>

                  {/* Photo previews */}
                  {result?.photoIds && result.photoIds.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {result.photoIds.map((url, i) => (
                        <img 
                          key={i} 
                          src={url} 
                          alt={`Issue photo ${i + 1}`}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3">
          {currentRoomIndex > 0 && (
            <Button
              variant="secondary"
              onClick={() => setCurrentRoomIndex(prev => prev - 1)}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
          )}
          
          {currentRoomIndex < totalRooms - 1 ? (
            <Button
              onClick={() => setCurrentRoomIndex(prev => prev + 1)}
              className="flex-1"
            >
              Next Room
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => setShowSignature(true)}
              className="flex-1"
              disabled={!customerSignature && issueCount === 0}
            >
              {customerSignature ? (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Complete ({issueCount} issues)
                </>
              ) : (
                <>
                  Sign & Complete
                  {issueCount > 0 && ` (${issueCount} issues)`}
                </>
              )}
            </Button>
          )}
        </div>
        
        {customerSignature && currentRoomIndex === totalRooms - 1 && (
          <Button
            onClick={handleSave}
            loading={saving}
            className="w-full mt-2"
          >
            Save Walk-Through
          </Button>
        )}
      </div>
    </div>
  );
}
