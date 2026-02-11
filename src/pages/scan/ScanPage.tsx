import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, ClipboardList, Wrench, ChevronRight, Check, Image, X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useJobsStore } from '../../stores/jobsStore';
import type { JobType } from '../../types';

export function ScanPage() {
  const navigate = useNavigate();
  const addJob = useJobsStore(state => state.addJob);
  
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [creating, setCreating] = useState(false);
  
  const [serialNumber, setSerialNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoData(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const createJob = () => {
    if (!jobType || !serialNumber.trim()) return;
    setCreating(true);
    
    try {
      const job = addJob({
        jobType,
        status: 'active',
        customerName: customerName.trim() || 'Unknown Customer',
        phone: phone || undefined,
        street: address.trim(),
        city: city.trim(),
        state: state.trim() || 'FL',
        zip: zip.trim(),
        serialNumber: serialNumber.trim().toUpperCase(),
      });
      navigate(`/job/${job.id}`);
    } catch (error: any) {
      alert(`Failed to create job: ${error?.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-2xl font-bold text-gray-100">New Job</h2>
        <p className="text-sm text-gray-500 mt-0.5">Snap the paperwork, enter the basics</p>
      </div>

      <div className="p-4 space-y-4">
        
        {/* Photo Section */}
        {!photoData ? (
          <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-blue-700">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Photo the Paperwork</h2>
                  <p className="text-blue-200 text-sm">Keeps a digital copy with the job</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => cameraRef.current?.click()}
                  fullWidth
                  className="bg-white/20 hover:bg-white/30 border-0"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  onClick={() => galleryRef.current?.click()}
                  fullWidth
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/20 border-0 text-white"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Gallery
                </Button>
              </div>
              
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </div>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="relative">
              <img src={photoData} alt="Form" className="w-full max-h-48 object-cover" />
              <button
                onClick={() => setPhotoData(null)}
                className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Photo saved
              </div>
            </div>
          </Card>
        )}

        {/* Quick Entry */}
        <Card>
          <h3 className="font-medium text-gray-200 mb-3">Job Details</h3>
          
          <div className="space-y-3">
            <Input
              label="Serial Number *"
              placeholder="e.g., N1-17670AB"
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
              <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
              <Input label="Zip" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </Card>

        {/* Job Type Selection */}
        {serialNumber.trim() && (
          <Card>
            <p className="text-sm font-medium text-gray-300 mb-3">Job Type</p>
            
            <div className="space-y-2">
              <button
                onClick={() => setJobType(jobType === 'walkthrough' ? null : 'walkthrough')}
                className={`w-full flex items-center gap-3 p-4 border-2 rounded-xl transition-colors ${
                  jobType === 'walkthrough' 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                }`}
              >
                <ClipboardList className={`w-6 h-6 ${jobType === 'walkthrough' ? 'text-blue-400' : 'text-gray-500'}`} />
                <div className="text-left flex-1">
                  <p className="font-medium text-gray-100">Walk-Through</p>
                  <p className="text-sm text-gray-500">$400 flat — Initial inspection</p>
                </div>
                {jobType === 'walkthrough' && <Check className="w-5 h-5 text-blue-400" />}
              </button>
              
              <button
                onClick={() => setJobType(jobType === 'work_order' ? null : 'work_order')}
                className={`w-full flex items-center gap-3 p-4 border-2 rounded-xl transition-colors ${
                  jobType === 'work_order' 
                    ? 'border-orange-500 bg-orange-500/10' 
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                }`}
              >
                <Wrench className={`w-6 h-6 ${jobType === 'work_order' ? 'text-orange-400' : 'text-gray-500'}`} />
                <div className="text-left flex-1">
                  <p className="font-medium text-gray-100">Return Work Order</p>
                  <p className="text-sm text-gray-500">$40/hr + mileage — Fix items</p>
                </div>
                {jobType === 'work_order' && <Check className="w-5 h-5 text-orange-400" />}
              </button>
            </div>
          </Card>
        )}

        {/* Create Button */}
        {jobType && serialNumber.trim() && (
          <Button
            onClick={createJob}
            loading={creating}
            fullWidth
            size="lg"
          >
            <Check className="w-5 h-5 mr-2" />
            Create {jobType === 'walkthrough' ? 'Walk-Through' : 'Work Order'}
          </Button>
        )}
      </div>
    </div>
  );
}
