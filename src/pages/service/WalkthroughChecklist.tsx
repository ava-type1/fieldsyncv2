import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Check, 
  Square,
  Camera,
  Save,
  FileText,
  Package,
  ClipboardList
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SignatureCapture } from '../../components/signatures/SignatureCapture';
import { PhotoCapture } from '../../components/photos/PhotoCapture';
import { walkthroughTasks, type ItemStatus, type ChecklistItemResult } from '../../data/walkthroughChecklist';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { downloadWalkthroughPDF } from '../../utils/generateWalkthroughPDF';

export function WalkthroughChecklist() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [results, setResults] = useState<Record<string, ChecklistItemResult>>({});
  const [specialNotes, setSpecialNotes] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState<string | null>(null);
  const [property, setProperty] = useState<{
    serialNumber?: string;
    customer: { firstName: string; lastName: string };
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null>(null);

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
          serialNumber: data.serial_number,
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          customer: {
            firstName: data.customer?.first_name || '',
            lastName: data.customer?.last_name || '',
          }
        });
      }
    }
    loadProperty();
  }, [propertyId]);

  const toggleItem = (itemId: string) => {
    setResults(prev => {
      const current = prev[itemId]?.status;
      const newStatus: ItemStatus = current === 'ok' ? 'pending' : 'ok';
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          itemId,
          status: newStatus,
        }
      };
    });
  };

  const getItemStatus = (itemId: string): ItemStatus => {
    return results[itemId]?.status || 'pending';
  };

  const completedCount = Object.values(results).filter(r => r.status === 'ok').length;
  const totalCount = walkthroughTasks.length;
  const progress = (completedCount / totalCount) * 100;

  const handleSave = async (generatePDF = false, generateMaterials = false) => {
    if (!propertyId || !user || !property) return;
    
    setSaving(true);
    try {
      const completedAt = new Date().toISOString();
      
      // Get incomplete items (these need return trip)
      const incompleteItems = walkthroughTasks
        .filter(task => getItemStatus(task.id) !== 'ok')
        .map(task => task.label);

      // Update the walkthrough phase
      const { error } = await supabase
        .from('phases')
        .update({
          status: 'completed',
          completed_at: completedAt,
          completed_by_user_id: user.id,
          notes: [
            incompleteItems.length > 0 
              ? `Items for return trip:\n${incompleteItems.map(i => `• ${i}`).join('\n')}`
              : 'Walk-through complete. All items checked.',
            specialNotes ? `\nSpecial Notes:\n${specialNotes}` : ''
          ].filter(Boolean).join('\n'),
          customer_signature_url: customerSignature,
          customer_signed_at: customerSignature ? completedAt : null,
        })
        .eq('property_id', propertyId)
        .eq('type', 'Initial Walk-Through');

      if (error) throw error;

      // Create return work orders for incomplete items
      if (incompleteItems.length > 0) {
        await supabase
          .from('phases')
          .update({
            status: 'scheduled',
            notes: `Return visit needed:\n${incompleteItems.map(i => `• ${i}`).join('\n')}${specialNotes ? `\n\nNotes: ${specialNotes}` : ''}`,
          })
          .eq('property_id', propertyId)
          .eq('type', 'Return Work Order #1');
      }

      // Generate materials list from incomplete items
      if (generateMaterials && incompleteItems.length > 0) {
        const materialsItems = incompleteItems.map((item, index) => ({
          name: item,
          description: '',
          quantity: 1,
          estimatedCost: null,
          status: 'needed',
        }));

        await supabase
          .from('materials_lists')
          .insert({
            property_id: propertyId,
            created_by_user_id: user.id,
            items: materialsItems,
            total_estimated_cost: null,
          });
      }

      // Fetch full property data for PDF
      if (generatePDF) {
        const { data: fullProperty } = await supabase
          .from('properties')
          .select('*, customer:customers(*)')
          .eq('id', propertyId)
          .single();

        if (fullProperty) {
          downloadWalkthroughPDF({
            property: {
              customerName: `${fullProperty.customer?.first_name || ''} ${fullProperty.customer?.last_name || ''}`,
              address: fullProperty.street,
              city: fullProperty.city,
              state: fullProperty.state,
              zip: fullProperty.zip,
              serialNumber: fullProperty.serial_number,
              model: fullProperty.model,
            },
            results,
            customerSignature: customerSignature || undefined,
            completedAt,
            technicianName: user.fullName || user.email,
          });
        }
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
          onCapture={(photoUrl) => {
            // Add photo to special notes or results
            setShowCamera(null);
          }}
          onClose={() => setShowCamera(null)}
        />
      </div>
    );
  }

  const incompleteCount = totalCount - completedCount;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
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
              {completedCount} of {totalCount} checked
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Form Header - Serial # and Date */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-bold text-gray-900">Walk-Through Checklist</h1>
        </div>
        <div className="flex gap-4 text-sm text-gray-600">
          <span><strong>Serial #:</strong> {property?.serialNumber || 'N/A'}</span>
          <span><strong>Date:</strong> {new Date().toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {property?.customer.firstName} {property?.customer.lastName}
        </p>
      </div>

      {/* Checklist Items */}
      <div className="p-4 space-y-2">
        {walkthroughTasks.map((task) => {
          const isChecked = getItemStatus(task.id) === 'ok';
          
          return (
            <button
              key={task.id}
              onClick={() => toggleItem(task.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                isChecked 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Checkbox */}
              <div className={`w-6 h-6 rounded flex items-center justify-center ${
                isChecked ? 'bg-green-500 text-white' : 'border-2 border-gray-300'
              }`}>
                {isChecked && <Check className="w-4 h-4" />}
              </div>
              
              {/* Label */}
              <span className={`flex-1 text-left ${isChecked ? 'text-green-700' : 'text-gray-700'}`}>
                {task.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Special Notes Section */}
      <div className="px-4 mb-4">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2">Special Notes</h3>
          <textarea
            placeholder="Enter any special notes for this walk-through..."
            className="w-full p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={4}
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
          />
          
          <button
            onClick={() => setShowCamera('notes')}
            className="flex items-center gap-2 mt-2 text-sm text-primary-600"
          >
            <Camera className="w-4 h-4" />
            Add Photo
          </button>
        </Card>
      </div>

      {/* Customer Signature Section */}
      <div className="px-4 mb-4">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-2">Customer Signature</h3>
          
          {customerSignature ? (
            <div className="space-y-2">
              <div className="border rounded-lg p-2 bg-gray-50">
                <img 
                  src={customerSignature} 
                  alt="Customer signature" 
                  className="max-h-20 mx-auto"
                />
              </div>
              <p className="text-sm text-green-600 text-center">
                ✓ Signed by {property?.customer.firstName} {property?.customer.lastName}
              </p>
              <button
                onClick={() => setShowSignature(true)}
                className="text-sm text-primary-600 w-full text-center"
              >
                Re-sign
              </button>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setShowSignature(true)}
              fullWidth
            >
              Tap to Sign
            </Button>
          )}
        </Card>
      </div>

      {/* Save Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe">
        <div className="space-y-3">
          {/* Summary */}
          <div className="text-center text-sm">
            {incompleteCount > 0 ? (
              <span className="text-orange-600">
                {incompleteCount} items need attention on return trip
              </span>
            ) : (
              <span className="text-green-600">
                ✓ All items checked - walk-through complete!
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => handleSave(true, false)}
              loading={saving}
              disabled={!customerSignature}
            >
              <FileText className="w-4 h-4 mr-1" />
              Save + PDF
            </Button>
            
            <Button
              onClick={() => handleSave(true, incompleteCount > 0)}
              loading={saving}
              disabled={!customerSignature}
            >
              <Save className="w-4 h-4 mr-1" />
              Complete
            </Button>
          </div>

          {!customerSignature && (
            <p className="text-xs text-center text-gray-500">
              Customer signature required to complete
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
