import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ScanLine, 
  ClipboardList, 
  Wrench,
  ChevronRight,
  Zap
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { WorkOrderScanner, ScannedWorkOrder } from '../../components/scanner/WorkOrderScanner';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export function QuickStart() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedWorkOrder | null>(null);
  const [jobType, setJobType] = useState<'walkthrough' | 'return' | null>(null);
  const [creating, setCreating] = useState(false);
  
  // Editable fields after scan
  const [serialNumber, setSerialNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [salesperson, setSalesperson] = useState('');

  const handleScanComplete = (data: ScannedWorkOrder) => {
    setScannedData(data);
    setSerialNumber(data.serialNumber || '');
    setCustomerName(data.customerName || '');
    setAddress(data.address || '');
    setCity(data.city || '');
    setState(data.state || 'FL');
    setZip(data.zip || '');
    setPhone(data.phone || '');
    setWorkPhone(data.workPhone || '');
    setPoNumber(data.poNumber || '');
    setLotNumber(data.lotNumber || '');
    setSalesperson(data.salesperson || '');
    setShowScanner(false);
  };

  const createJobAndStart = async () => {
    if (!user || !jobType) return;
    
    setCreating(true);
    try {
      // Split customer name - handle hyphenated names like "Jessica Noel-Medeiros"
      const nameParts = customerName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Get user's organization - try organization_members first, fallback to users table
      let organizationId: string | null = null;
      
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (membership) {
        organizationId = membership.organization_id;
      } else {
        // Fallback: check users table directly
        const { data: userData } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        
        if (userData?.organization_id) {
          organizationId = userData.organization_id;
        }
      }

      if (!organizationId) throw new Error('No organization found. Please complete onboarding first.');

      // Create customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          organization_id: organizationId,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          preferred_contact: 'phone',
          notes: workPhone ? `Work: ${workPhone}` : undefined,
        })
        .select()
        .single();

      if (customerError) {
        console.error('Customer create error:', customerError);
        throw new Error(`Customer: ${customerError.message}`);
      }

      // Build notes for property
      const propertyNotes = [
        lotNumber && `Lot #: ${lotNumber}`,
        salesperson && `Salesperson: ${salesperson}`,
      ].filter(Boolean).join('\n');

      // Create property
      // Note: dealership_id is required - for now use the user's org as the dealership
      // In the future, this could be a separate dealership selection/lookup
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert({
          customer_id: customer.id,
          dealership_id: organizationId,  // Required field
          created_by_org_id: organizationId,
          street: address,
          city: city,
          state: state,
          zip: zip,
          manufacturer: 'Nobility Homes',
          serial_number: serialNumber,
          model: scannedData?.model || null,
          overall_status: 'in_progress',
          current_phase: jobType === 'walkthrough' ? 'Initial Walk-Through' : 'Return Work Order #1',
        })
        .select()
        .single();

      if (propertyError) {
        console.error('Property create error:', propertyError);
        throw new Error(`Property: ${propertyError.message}`);
      }

      // Create phases
      const phaseNotes = [
        poNumber && `P.O.#: ${poNumber}`,
        propertyNotes,
      ].filter(Boolean).join('\n');

      const phases = jobType === 'walkthrough' 
        ? [
            { type: 'Initial Walk-Through', category: 'service', sort_order: 1, status: 'in_progress' },
            { type: 'Return Work Order #1', category: 'service', sort_order: 2, status: 'not_started' },
          ]
        : [
            { type: 'Return Work Order #1', category: 'service', sort_order: 1, status: 'in_progress' },
          ];

      await supabase
        .from('phases')
        .insert(phases.map(p => ({
          ...p,
          property_id: property.id,
          notes: phaseNotes || null,
        })));

      // Navigate to the appropriate form
      const path = jobType === 'walkthrough'
        ? `/property/${property.id}/walkthrough-checklist`
        : `/property/${property.id}/return-work-order`;
      
      navigate(path);

    } catch (error: any) {
      console.error('Error creating job:', error);
      alert(`Failed to create job: ${error?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setCreating(false);
    }
  };

  if (showScanner) {
    return (
      <WorkOrderScanner
        onScanComplete={handleScanComplete}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Quick Start</h1>
        <p className="text-sm text-gray-500 mt-1">Start a new job in seconds</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Scan or Enter */}
        {!scannedData && !serialNumber && (
          <>
            <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <button
                onClick={() => setShowScanner(true)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ScanLine className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">Scan Service Form</h2>
                    <p className="text-white/80 text-sm">
                      Snap a photo of Matt's paperwork
                    </p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-white/60" />
                </div>
              </button>
            </Card>

            <div className="text-center text-gray-400 text-sm">— or —</div>

            <Card>
              <h3 className="font-medium text-gray-900 mb-3">Enter Manually</h3>
              <Input
                label="Serial Number"
                placeholder="e.g., N1-17670AB"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              />
              {serialNumber && (
                <Button 
                  onClick={() => setScannedData({ rawText: '', serialNumber })}
                  className="mt-3"
                  fullWidth
                >
                  Continue
                </Button>
              )}
            </Card>
          </>
        )}

        {/* Step 2: Review/Edit Data */}
        {(scannedData || serialNumber) && !jobType && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-medium text-gray-900">Job Details</h3>
            </div>

            <div className="space-y-3">
              <Input
                label="Serial Number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              />
              <Input
                label="Customer Name"
                placeholder="First Last"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                label="Address"
                placeholder="Street address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="Zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Home Phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Input
                  label="Work Phone"
                  type="tel"
                  value={workPhone}
                  onChange={(e) => setWorkPhone(e.target.value)}
                />
              </div>
              
              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-gray-500 mb-2">Optional Info</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Lot #"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                  />
                  <Input
                    label="Salesperson"
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value)}
                  />
                </div>
                <Input
                  label="P.O. #"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-gray-700">What type of job?</p>
              
              <button
                onClick={() => setJobType('walkthrough')}
                className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors"
              >
                <ClipboardList className="w-6 h-6 text-blue-500" />
                <div className="text-left flex-1">
                  <p className="font-medium">Walk-Through</p>
                  <p className="text-sm text-gray-500">Initial inspection</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              
              <button
                onClick={() => setJobType('return')}
                className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors"
              >
                <Wrench className="w-6 h-6 text-orange-500" />
                <div className="text-left flex-1">
                  <p className="font-medium">Return Work Order</p>
                  <p className="text-sm text-gray-500">Fix items from list</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </Card>
        )}

        {/* Step 3: Confirm and Start */}
        {jobType && (
          <Card className="bg-green-50 border-green-200">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                {jobType === 'walkthrough' ? (
                  <ClipboardList className="w-6 h-6 text-green-600" />
                ) : (
                  <Wrench className="w-6 h-6 text-green-600" />
                )}
              </div>
              <h3 className="font-semibold text-gray-900">
                Ready to start {jobType === 'walkthrough' ? 'Walk-Through' : 'Return Work Order'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {customerName || 'Customer'} • {serialNumber || 'No Serial'}
              </p>
            </div>

            <Button 
              onClick={createJobAndStart}
              loading={creating}
              fullWidth
              className="mt-4"
            >
              Create Job & Start
            </Button>
            
            <button
              onClick={() => setJobType(null)}
              className="w-full text-center text-sm text-gray-500 mt-2"
            >
              ← Go back
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
