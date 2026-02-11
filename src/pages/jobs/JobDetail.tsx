import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, MapPin, Phone, Navigation, Camera, Package,
  ClipboardCheck, Wrench, CheckCircle, Trash2, Edit3, 
  PenTool, Clock, Image as ImageIcon
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useJobsStore } from '../../stores/jobsStore';
import type { Job, JobStatus } from '../../types';

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const job = useJobsStore(state => state.jobs.find(j => j.id === id));
  const updateJob = useJobsStore(state => state.updateJob);
  const deleteJob = useJobsStore(state => state.deleteJob);
  const addPhoto = useJobsStore(state => state.addPhoto);
  const toggleChecklistItem = useJobsStore(state => state.toggleChecklistItem);
  const addChecklistItem = useJobsStore(state => state.addChecklistItem);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'materials' | 'checklist'>('details');

  if (!job) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Job not found</p>
        <Button variant="ghost" onClick={() => navigate('/jobs')} className="mt-4">← Back to Jobs</Button>
      </div>
    );
  }

  const openInMaps = () => {
    const address = `${job.street}, ${job.city}, ${job.state} ${job.zip}`;
    const encoded = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS ? `maps://maps.apple.com/?q=${encoded}` : `https://maps.google.com/?q=${encoded}`;
    window.open(url, '_blank');
  };

  const handlePhotoCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        addPhoto(job.id, {
          dataUrl,
          photoType: 'general',
          takenAt: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleStatusChange = (status: JobStatus) => {
    updateJob(job.id, { 
      status,
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    });
  };

  const handleDelete = () => {
    deleteJob(job.id);
    navigate('/jobs', { replace: true });
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    addChecklistItem(job.id, newChecklistItem.trim());
    setNewChecklistItem('');
  };

  const completedChecklist = job.checklistItems.filter(i => i.completed).length;
  const totalChecklist = job.checklistItems.length;

  const tabs = [
    { key: 'details', label: 'Details', icon: Edit3 },
    { key: 'photos', label: `Photos (${job.photos.length})`, icon: ImageIcon },
    { key: 'materials', label: `Materials (${job.materials.length})`, icon: Package },
    { key: 'checklist', label: `List (${completedChecklist}/${totalChecklist})`, icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/jobs')} className="text-gray-400 hover:text-gray-200 -ml-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-100 truncate">{job.customerName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${
                job.jobType === 'walkthrough' ? 'text-blue-400' : 'text-orange-400'
              }`}>
                {job.jobType === 'walkthrough' ? 'Walk-Through' : 'Work Order'}
              </span>
              {job.serialNumber && (
                <span className="text-xs text-gray-500 font-mono">• {job.serialNumber}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pt-4 flex gap-2">
        {job.phone && (
          <a href={`tel:${job.phone}`} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm font-medium active:bg-gray-700">
            <Phone className="w-4 h-4" />
            Call
          </a>
        )}
        <button onClick={openInMaps} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm font-medium active:bg-gray-700">
          <Navigation className="w-4 h-4" />
          Navigate
        </button>
        <button onClick={handlePhotoCapture} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm font-medium active:bg-gray-700">
          <Camera className="w-4 h-4" />
          Photo
        </button>
      </div>

      {/* Status Buttons */}
      <div className="px-4 pt-3 flex gap-2">
        {(['active', 'in_progress', 'completed'] as JobStatus[]).map(status => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
              job.status === status
                ? status === 'completed' ? 'bg-green-600 text-white' : status === 'in_progress' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            {status === 'active' ? 'Active' : status === 'in_progress' ? 'In Progress' : 'Done'}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 flex gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === key
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pt-3 space-y-3">
        {activeTab === 'details' && (
          <>
            <Card>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Address</h3>
              <p className="text-gray-100">{job.street}</p>
              <p className="text-gray-400 text-sm">{job.city}, {job.state} {job.zip}</p>
            </Card>

            {(job.phone || job.workPhone || job.cellPhone) && (
              <Card>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Contact</h3>
                {job.phone && <div className="flex justify-between"><span className="text-gray-500 text-sm">Home</span><a href={`tel:${job.phone}`} className="text-blue-400 text-sm">{job.phone}</a></div>}
                {job.workPhone && <div className="flex justify-between mt-1"><span className="text-gray-500 text-sm">Work</span><a href={`tel:${job.workPhone}`} className="text-blue-400 text-sm">{job.workPhone}</a></div>}
                {job.cellPhone && <div className="flex justify-between mt-1"><span className="text-gray-500 text-sm">Cell</span><a href={`tel:${job.cellPhone}`} className="text-blue-400 text-sm">{job.cellPhone}</a></div>}
              </Card>
            )}

            {(job.poNumber || job.model || job.lotNumber || job.salesperson) && (
              <Card>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Job Info</h3>
                <div className="space-y-1">
                  {job.poNumber && <div className="flex justify-between"><span className="text-gray-500 text-sm">P.O. #</span><span className="text-gray-200 text-sm">{job.poNumber}</span></div>}
                  {job.model && <div className="flex justify-between"><span className="text-gray-500 text-sm">Model</span><span className="text-gray-200 text-sm">{job.model}</span></div>}
                  {job.lotNumber && <div className="flex justify-between"><span className="text-gray-500 text-sm">Lot #</span><span className="text-gray-200 text-sm">{job.lotNumber}</span></div>}
                  {job.salesperson && <div className="flex justify-between"><span className="text-gray-500 text-sm">Salesperson</span><span className="text-gray-200 text-sm">{job.salesperson}</span></div>}
                </div>
              </Card>
            )}

            {/* Signatures */}
            {job.signatures.length > 0 && (
              <Card>
                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Signatures ({job.signatures.length})
                </h3>
                {job.signatures.map(sig => (
                  <div key={sig.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                    <div className="w-16 h-10 bg-gray-800 rounded overflow-hidden">
                      <img src={sig.signatureData} alt="Signature" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-200">{sig.signedByName}</p>
                      <p className="text-xs text-gray-500">{sig.signedByRole} · {new Date(sig.signedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Notes */}
            <Card>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Notes</h3>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
                placeholder="Add notes..."
                value={job.notes || ''}
                onChange={(e) => updateJob(job.id, { notes: e.target.value })}
              />
            </Card>

            {/* Delete */}
            <div className="pt-2">
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-red-400 text-sm mx-auto">
                  <Trash2 className="w-4 h-4" />
                  Delete Job
                </button>
              ) : (
                <Card className="border-red-800 bg-red-950/30">
                  <p className="text-sm text-red-300 text-center mb-3">Delete this job and all its data?</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} fullWidth size="sm">Cancel</Button>
                    <Button variant="danger" onClick={handleDelete} fullWidth size="sm">Delete</Button>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}

        {activeTab === 'photos' && (
          <>
            <Button onClick={handlePhotoCapture} fullWidth variant="outline" className="gap-2">
              <Camera className="w-5 h-5" />
              Take Photo
            </Button>
            {job.photos.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {job.photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800">
                    <img
                      src={photo.dataUrl || photo.remoteUrl}
                      alt={photo.caption || 'Job photo'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2">
                      <p className="text-xs text-gray-200">{new Date(photo.takenAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'materials' && (
          <>
            {job.materials.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No materials tracked</p>
              </div>
            ) : (
              job.materials.map(mat => (
                <Card key={mat.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-100 font-medium">{mat.name}</p>
                      <p className="text-gray-500 text-sm">{mat.quantity} {mat.unit} · {mat.category}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg ${
                      mat.status === 'installed' ? 'bg-green-500/20 text-green-400' :
                      mat.status === 'purchased' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {mat.status}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {activeTab === 'checklist' && (
          <>
            {/* Add item */}
            <div className="flex gap-2">
              <Input
                placeholder="Add checklist item..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                className="flex-1"
              />
              <Button onClick={handleAddChecklistItem} size="sm" disabled={!newChecklistItem.trim()}>
                Add
              </Button>
            </div>

            {/* Progress */}
            {totalChecklist > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${(completedChecklist / totalChecklist) * 100}%` }} />
                </div>
                <span className="text-sm text-gray-400">{completedChecklist}/{totalChecklist}</span>
              </div>
            )}

            {job.checklistItems.map(item => (
              <button
                key={item.id}
                onClick={() => toggleChecklistItem(job.id, item.id)}
                className="w-full flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl transition-colors hover:bg-gray-800"
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.completed ? 'bg-green-600 border-green-600' : 'border-gray-600'
                }`}>
                  {item.completed && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <span className={`text-sm flex-1 text-left ${item.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                  {item.label}
                </span>
              </button>
            ))}

            {totalChecklist === 0 && (
              <div className="text-center py-8">
                <ClipboardCheck className="w-12 h-12 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No checklist items yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
