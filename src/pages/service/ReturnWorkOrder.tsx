import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Plus,
  Trash2,
  Camera,
  Save,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SignatureCapture } from '../../components/signatures/SignatureCapture';
import { PhotoCapture } from '../../components/photos/PhotoCapture';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface WorkItem {
  id: string;
  problem: string;
  workToBeDone: string;
  notes?: string;
  photoUrls: string[];
  completed: boolean;
}

interface PropertyData {
  id: string;
  serialNumber: string;
  model: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
  };
}

export function ReturnWorkOrder() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [poNumber, setPoNumber] = useState('');
  const [claimNumber, setClaimNumber] = useState('');
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(true);
  const [showSignature, setShowSignature] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [techSignature, setTechSignature] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState<string | null>(null);
  
  // New item form
  const [newProblem, setNewProblem] = useState('');
  const [newWorkToBeDone, setNewWorkToBeDone] = useState('');

  // Load property info
  useEffect(() => {
    async function loadProperty() {
      if (!propertyId) return;
      
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*, customer:customers(*)')
          .eq('id', propertyId)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setProperty({
            id: data.id,
            serialNumber: data.serial_number || '',
            model: data.model || '',
            street: data.street,
            city: data.city,
            state: data.state,
            zip: data.zip,
            customer: {
              firstName: data.customer?.first_name || '',
              lastName: data.customer?.last_name || '',
              phone: data.customer?.phone || '',
            }
          });
        }
      } catch (err) {
        console.error('Error loading property:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadProperty();
  }, [propertyId]);

  const addWorkItem = () => {
    if (!newProblem.trim()) return;
    
    const item: WorkItem = {
      id: Date.now().toString(),
      problem: newProblem.trim(),
      workToBeDone: newWorkToBeDone.trim(),
      photoUrls: [],
      completed: false,
    };
    
    setWorkItems(prev => [...prev, item]);
    setNewProblem('');
    setNewWorkToBeDone('');
    setShowAddItem(false);
  };

  const removeWorkItem = (id: string) => {
    setWorkItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleItemComplete = (id: string) => {
    setWorkItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const addPhotoToItem = (itemId: string, photoUrl: string) => {
    setWorkItems(prev => prev.map(item =>
      item.id === itemId 
        ? { ...item, photoUrls: [...item.photoUrls, photoUrl] }
        : item
    ));
    setShowCamera(null);
  };

  const updateItemNotes = (id: string, notes: string) => {
    setWorkItems(prev => prev.map(item =>
      item.id === id ? { ...item, notes } : item
    ));
  };

  const completedCount = workItems.filter(i => i.completed).length;
  const progress = workItems.length > 0 ? (completedCount / workItems.length) * 100 : 0;

  const handleSave = async (generatePDF = false) => {
    if (!propertyId || !user || !property) return;
    
    setSaving(true);
    try {
      const completedAt = new Date().toISOString();
      
      // Build notes from work items
      const itemsNotes = workItems.map((item, i) => 
        `${i + 1}. ${item.problem}\n   Work: ${item.workToBeDone}${item.notes ? `\n   Notes: ${item.notes}` : ''}${item.completed ? ' ✓' : ''}`
      ).join('\n\n');

      // Update the return work order phase
      const { error } = await supabase
        .from('phases')
        .update({
          status: completedCount === workItems.length ? 'completed' : 'in_progress',
          completed_at: completedCount === workItems.length ? completedAt : null,
          completed_by_user_id: completedCount === workItems.length ? user.id : null,
          notes: `P.O.#: ${poNumber}\nClaim#: ${claimNumber}\n\nWork Items:\n${itemsNotes}`,
          customer_signature_url: customerSignature,
          customer_signed_at: customerSignature ? completedAt : null,
        })
        .eq('property_id', propertyId)
        .in('type', ['Return Work Order #1', 'Return Work Order #2', 'Return Work Order #3']);

      if (error) throw error;

      // TODO: Generate PDF if requested
      if (generatePDF) {
        // Will implement PDF generation
        console.log('PDF generation requested');
      }

      navigate(`/property/${propertyId}`);
    } catch (error) {
      console.error('Error saving return work order:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (showSignature) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {!customerSignature ? 'Customer Signature' : 'Technician Signature'}
          </h2>
          <p className="text-gray-600 mb-4">
            {!customerSignature 
              ? `${property?.customer.firstName} ${property?.customer.lastName} acknowledges the work completed.`
              : 'Technician confirms work completion.'
            }
          </p>
          
          <SignatureCapture
            onSave={(signature) => {
              if (!customerSignature) {
                setCustomerSignature(signature);
              } else {
                setTechSignature(signature);
                setShowSignature(false);
              }
            }}
            onCancel={() => setShowSignature(false)}
          />
          
          {customerSignature && !techSignature && (
            <p className="text-center text-sm text-gray-500 mt-4">
              ✓ Customer signed — now get technician signature
            </p>
          )}
        </div>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="min-h-screen bg-black">
        <PhotoCapture
          onCapture={(photoUrl) => addPhotoToItem(showCamera, photoUrl)}
          onClose={() => setShowCamera(null)}
        />
      </div>
    );
  }

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
            <span className="text-sm font-medium text-primary-600">
              Return Work Order
            </span>
          </div>
          
          {/* Progress bar */}
          {workItems.length > 0 && (
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Job Header - Auto-filled */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {property?.customer.firstName} {property?.customer.lastName}
            </h1>
            <p className="text-sm text-gray-500">
              {property?.street}, {property?.city}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-500">Serial #</p>
            <p className="font-mono font-medium">{property?.serialNumber || 'N/A'}</p>
          </div>
        </div>
        
        {/* P.O. and Claim # */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Input
            label="P.O. #"
            placeholder="Enter P.O. number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
          <Input
            label="Claim #"
            placeholder="Enter claim number"
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
          />
        </div>
        
        {/* Date - Auto-filled */}
        <p className="text-xs text-gray-400 mt-3">
          Date: {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Work Items */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Work Items ({completedCount}/{workItems.length})
          </h2>
          {!showAddItem && (
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1 text-primary-600 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>

        {/* Add New Item Form */}
        {showAddItem && (
          <Card className="mb-4 border-2 border-dashed border-primary-200 bg-primary-50">
            <h3 className="font-medium text-gray-900 mb-3">New Work Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Problem
                </label>
                <input
                  type="text"
                  placeholder="e.g., Shingle damaged, Kitchen sink leak"
                  className="w-full p-3 border rounded-lg text-sm"
                  value={newProblem}
                  onChange={(e) => setNewProblem(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work To Be Done
                </label>
                <textarea
                  placeholder="e.g., Replace 6 shingles, Install new faucet"
                  className="w-full p-3 border rounded-lg text-sm resize-none"
                  rows={2}
                  value={newWorkToBeDone}
                  onChange={(e) => setNewWorkToBeDone(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addWorkItem} disabled={!newProblem.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
                <Button variant="secondary" onClick={() => setShowAddItem(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Work Items List */}
        <div className="space-y-3">
          {workItems.map((item, index) => (
            <Card 
              key={item.id} 
              className={`transition-colors ${item.completed ? 'bg-green-50 border-green-200' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Completion checkbox */}
                <button
                  onClick={() => toggleItemComplete(item.id)}
                  className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    item.completed 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'border-gray-300'
                  }`}
                >
                  {item.completed && '✓'}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`font-medium ${item.completed ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                        {index + 1}. {item.problem}
                      </p>
                      <p className={`text-sm mt-1 ${item.completed ? 'text-green-600' : 'text-gray-600'}`}>
                        → {item.workToBeDone}
                      </p>
                    </div>
                    <button
                      onClick={() => removeWorkItem(item.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Notes */}
                  <textarea
                    placeholder="Add notes..."
                    className="w-full mt-2 p-2 border rounded text-sm resize-none bg-white"
                    rows={1}
                    value={item.notes || ''}
                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                  />
                  
                  {/* Photos */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setShowCamera(item.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded text-xs text-blue-700"
                    >
                      <Camera className="w-3 h-3" />
                      Photo
                    </button>
                    {item.photoUrls.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {item.photoUrls.length} photo(s)
                      </span>
                    )}
                  </div>
                  
                  {/* Photo previews */}
                  {item.photoUrls.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {item.photoUrls.map((url, i) => (
                        <img 
                          key={i} 
                          src={url} 
                          alt={`Work photo ${i + 1}`}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {workItems.length === 0 && !showAddItem && (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No work items yet</p>
            <button
              onClick={() => setShowAddItem(true)}
              className="text-primary-600 text-sm font-medium mt-2"
            >
              + Add your first item
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe">
        {workItems.length > 0 && (
          <div className="space-y-3">
            {/* Signature status */}
            <div className="flex items-center justify-center gap-4 text-sm">
              {customerSignature ? (
                <span className="text-green-600">✓ Customer signed</span>
              ) : (
                <span className="text-gray-400">○ Customer signature needed</span>
              )}
              {techSignature ? (
                <span className="text-green-600">✓ Tech signed</span>
              ) : (
                <span className="text-gray-400">○ Tech signature needed</span>
              )}
            </div>
            
            {!customerSignature || !techSignature ? (
              <Button onClick={() => setShowSignature(true)} fullWidth>
                Get {!customerSignature ? 'Customer' : 'Technician'} Signature
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleSave(true)}
                  loading={saving}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Save + PDF
                </Button>
                <Button onClick={() => handleSave(false)} loading={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
