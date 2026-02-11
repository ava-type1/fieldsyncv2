import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ScanLine, ClipboardList, Wrench, ChevronRight, Zap, Check
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { WorkOrderScanner, ScannedWorkOrder } from '../../components/scanner/WorkOrderScanner';
import { useJobsStore } from '../../stores/jobsStore';
import type { JobType } from '../../types';

export function ScanPage() {
  const navigate = useNavigate();
  const addJob = useJobsStore(state => state.addJob);
  
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedWorkOrder | null>(null);
  const [jobType, setJobType] = useState<JobType | null>(null);
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

  const createJob = () => {
    if (!jobType) return;
    
    setCreating(true);
    
    try {
      const job = addJob({
        jobType,
        status: 'active',
        customerName: customerName.trim() || 'Unknown Customer',
        phone: phone || undefined,
        workPhone: workPhone || undefined,
        street: address.trim(),
        city: city.trim(),
        state: state.trim() || 'FL',
        zip: zip.trim(),
        serialNumber: serialNumber || undefined,
        poNumber: poNumber || undefined,
        model: scannedData?.model || undefined,
        lotNumber: lotNumber || undefined,
        salesperson: salesperson || undefined,
        setupBy: scannedData?.setupBy || undefined,
      });

      // Navigate to the new job
      navigate(`/job/${job.id}`);
    } catch (error: any) {
      console.error('Error creating job:', error);
      alert(`Failed to create job: ${error?.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setScannedData(null);
    setJobType(null);
    setSerialNumber('');
    setCustomerName('');
    setAddress('');
    setCity('');
    setState('FL');
    setZip('');
    setPhone('');
    setWorkPhone('');
    setPoNumber('');
    setLotNumber('');
    setSalesperson('');
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
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-2xl font-bold text-gray-100">New Job</h2>
        <p className="text-sm text-gray-500 mt-0.5">Scan paperwork or enter details manually</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Scan or Enter */}
        {!scannedData && !serialNumber && (
          <>
            <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-blue-700">
              <button
                onClick={() => setShowScanner(true)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <ScanLine className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-white">Scan Service Form</h2>
                    <p className="text-blue-200 text-sm">
                      Snap a photo of Matt's paperwork
                    </p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-blue-300" />
                </div>
              </button>
            </Card>

            <div className="text-center text-gray-600 text-sm">— or enter manually —</div>

            <Card>
              <h3 className="font-medium text-gray-200 mb-3">Manual Entry</h3>
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
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="font-medium text-gray-100">Job Details</h3>
              <button onClick={resetForm} className="ml-auto text-sm text-gray-500 hover:text-gray-300">
                Reset
              </button>
            </div>

            <div className="space-y-3">
              <Input label="Serial Number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value.toUpperCase())} />
              <Input label="Customer Name" placeholder="First Last" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <Input label="Address" placeholder="Street address" value={address} onChange={(e) => setAddress(e.target.value)} />
              
              <div className="grid grid-cols-3 gap-2">
                <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
                <Input label="Zip" value={zip} onChange={(e) => setZip(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Input label="Home Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input label="Work Phone" type="tel" value={workPhone} onChange={(e) => setWorkPhone(e.target.value)} />
              </div>
              
              <div className="border-t border-gray-800 pt-3 mt-3">
                <p className="text-xs text-gray-500 mb-2">Optional Info</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Lot #" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
                  <Input label="Salesperson" value={salesperson} onChange={(e) => setSalesperson(e.target.value)} />
                </div>
                <Input label="P.O. #" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="mt-2" />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-gray-300">What type of job?</p>
              
              <button
                onClick={() => setJobType('walkthrough')}
                className="w-full flex items-center gap-3 p-4 border-2 border-gray-700 rounded-xl hover:border-blue-500 transition-colors bg-gray-800/50"
              >
                <ClipboardList className="w-6 h-6 text-blue-400" />
                <div className="text-left flex-1">
                  <p className="font-medium text-gray-100">Walk-Through</p>
                  <p className="text-sm text-gray-500">$400 flat — Initial inspection</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              
              <button
                onClick={() => setJobType('work_order')}
                className="w-full flex items-center gap-3 p-4 border-2 border-gray-700 rounded-xl hover:border-orange-500 transition-colors bg-gray-800/50"
              >
                <Wrench className="w-6 h-6 text-orange-400" />
                <div className="text-left flex-1">
                  <p className="font-medium text-gray-100">Return Work Order</p>
                  <p className="text-sm text-gray-500">$40/hr + mileage — Fix items</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </Card>
        )}

        {/* Step 3: Confirm and Create */}
        {jobType && (
          <Card className="bg-green-950/30 border-green-800">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full mb-3">
                {jobType === 'walkthrough' ? (
                  <ClipboardList className="w-6 h-6 text-green-400" />
                ) : (
                  <Wrench className="w-6 h-6 text-green-400" />
                )}
              </div>
              <h3 className="font-semibold text-gray-100">
                Ready to start {jobType === 'walkthrough' ? 'Walk-Through' : 'Work Order'}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {customerName || 'Customer'} • {serialNumber || 'No Serial'}
              </p>
            </div>

            <Button 
              onClick={createJob}
              loading={creating}
              fullWidth
              className="mt-4"
            >
              <Check className="w-5 h-5 mr-2" />
              Create Job
            </Button>
            
            <button
              onClick={() => setJobType(null)}
              className="w-full text-center text-sm text-gray-500 mt-2 hover:text-gray-300"
            >
              ← Change type
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
