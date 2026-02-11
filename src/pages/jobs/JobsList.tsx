import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Phone, ChevronRight, ScanLine, ClipboardCheck, Wrench,
  CheckCircle, Clock, Pause, Filter
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useJobsStore } from '../../stores/jobsStore';
import type { Job, JobStatus, JobType } from '../../types';

const statusConfig: Record<JobStatus, { label: string; color: string; bg: string; icon: any }> = {
  active: { label: 'Active', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  on_hold: { label: 'On Hold', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: Pause },
};

const typeConfig: Record<JobType, { label: string; icon: any; color: string }> = {
  walkthrough: { label: 'Walk-Through', icon: ClipboardCheck, color: 'text-blue-400' },
  work_order: { label: 'Work Order', icon: Wrench, color: 'text-orange-400' },
};

export function JobsList() {
  const navigate = useNavigate();
  const jobs = useJobsStore(state => state.jobs);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | JobType>('all');

  const filteredJobs = jobs.filter(job => {
    if (filter === 'active' && (job.status === 'completed')) return false;
    if (filter === 'completed' && job.status !== 'completed') return false;
    if (typeFilter !== 'all' && job.jobType !== typeFilter) return false;
    return true;
  });

  const activeCount = jobs.filter(j => j.status !== 'completed').length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gray-950 pb-4">
      {/* Stats Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Jobs</h2>
            <p className="text-sm text-gray-500 mt-0.5">{activeCount} active · {completedCount} done</p>
          </div>
          <button
            onClick={() => navigate('/scan')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors active:scale-95"
          >
            <ScanLine className="w-5 h-5" />
            <span>New Job</span>
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Done' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="w-px bg-gray-800 mx-1" />
          {[
            { key: 'all', label: 'All Types' },
            { key: 'walkthrough', label: 'Walk-Through' },
            { key: 'work_order', label: 'Work Order' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key as any)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                typeFilter === key
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      <div className="px-4 space-y-3 mt-2">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
              <ScanLine className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-300">No jobs yet</h3>
            <p className="text-sm text-gray-500 mt-1 text-center max-w-xs">
              Scan a Nobility service form to create your first job
            </p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium active:scale-95 transition-transform"
            >
              <ScanLine className="w-5 h-5" />
              Scan Work Order
            </button>
          </div>
        ) : (
          filteredJobs.map((job) => <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />)
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const status = statusConfig[job.status];
  const type = typeConfig[job.jobType];
  const StatusIcon = status.icon;
  const TypeIcon = type.icon;

  return (
    <Card onClick={onClick} className="relative">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Customer Name */}
          <h3 className="font-semibold text-gray-100 text-lg truncate">
            {job.customerName || 'Unknown Customer'}
          </h3>

          {/* Address */}
          <div className="flex items-center gap-2 mt-1.5 text-gray-400">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm truncate">
              {job.street}{job.city ? `, ${job.city}` : ''}
            </span>
          </div>

          {/* Phone */}
          {job.phone && (
            <div className="flex items-center gap-2 mt-1 text-gray-400">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <a
                href={`tel:${job.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-blue-400"
              >
                {job.phone}
              </a>
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0 mt-1" />
      </div>

      {/* Bottom row: type + status + serial */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${type.color} bg-gray-800`}>
          <TypeIcon className="w-3.5 h-3.5" />
          {type.label}
        </span>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${status.color} ${status.bg}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </span>
        {job.serialNumber && (
          <span className="text-xs text-gray-500 font-mono ml-auto">{job.serialNumber}</span>
        )}
      </div>
    </Card>
  );
}
