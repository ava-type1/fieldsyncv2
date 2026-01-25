import { Check, Clock, AlertCircle, Circle } from 'lucide-react';
import type { Phase, PhaseStatus } from '../../types';

interface PhaseTimelineProps {
  phases: Phase[];
}

const statusIcons: Record<PhaseStatus, typeof Check> = {
  completed: Check,
  in_progress: Clock,
  blocked: AlertCircle,
  on_hold: AlertCircle,
  scheduled: Clock,
  not_started: Circle,
  skipped: Circle,
};

const statusColors: Record<PhaseStatus, { bg: string; border: string; text: string }> = {
  completed: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-600' },
  in_progress: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-600' },
  blocked: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-600' },
  on_hold: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-600' },
  scheduled: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-600' },
  not_started: { bg: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-500' },
  skipped: { bg: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-400' },
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
  });
}

export function PhaseTimeline({ phases }: PhaseTimelineProps) {
  if (phases.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No phases defined for this property.
      </div>
    );
  }

  return (
    <div className="relative">
      {phases.map((phase, index) => {
        const Icon = statusIcons[phase.status];
        const colors = statusColors[phase.status];
        const isLast = index === phases.length - 1;

        return (
          <div key={phase.id} className="relative flex gap-4 pb-6">
            {/* Timeline line */}
            {!isLast && (
              <div
                className={`absolute left-4 top-8 w-0.5 h-full ${
                  phase.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}

            {/* Status icon */}
            <div
              className={`
                relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2
                ${phase.status === 'completed' ? colors.bg : 'bg-white'}
                ${colors.border}
              `}
            >
              <Icon
                className={`w-4 h-4 ${
                  phase.status === 'completed' ? 'text-white' : colors.text
                }`}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p
                  className={`font-medium ${
                    phase.status === 'skipped' ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                >
                  {formatPhaseName(phase.type)}
                </p>
                {phase.completedAt && (
                  <span className="text-sm text-gray-500">{formatDate(phase.completedAt)}</span>
                )}
                {!phase.completedAt && phase.scheduledDate && (
                  <span className="text-sm text-blue-600">{formatDate(phase.scheduledDate)}</span>
                )}
              </div>

              {/* Status badge */}
              <span
                className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                  phase.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : phase.status === 'in_progress'
                    ? 'bg-yellow-100 text-yellow-700'
                    : phase.status === 'blocked'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {phase.status.replace(/_/g, ' ')}
              </span>

              {/* Notes */}
              {phase.notes && (
                <p className="mt-2 text-sm text-gray-600">{phase.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
