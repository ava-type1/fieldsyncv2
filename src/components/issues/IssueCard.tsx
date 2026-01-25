import { AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import type { Issue } from '../../types';

interface IssueCardProps {
  issue: Issue;
  onClick?: () => void;
}

const severityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const statusColors = {
  reported: 'text-blue-600',
  acknowledged: 'text-purple-600',
  in_progress: 'text-yellow-600',
  pending_parts: 'text-orange-600',
  resolved: 'text-green-600',
  wont_fix: 'text-gray-600',
  duplicate: 'text-gray-400',
};

export function IssueCard({ issue, onClick }: IssueCardProps) {
  return (
    <Card onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            issue.severity === 'critical' || issue.severity === 'high'
              ? 'bg-red-50'
              : 'bg-gray-50'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 ${
              issue.severity === 'critical'
                ? 'text-red-500'
                : issue.severity === 'high'
                ? 'text-orange-500'
                : 'text-yellow-500'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900">{issue.title}</h3>
            <span
              className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                severityColors[issue.severity]
              }`}
            >
              {issue.severity}
            </span>
          </div>

          {issue.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{issue.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {issue.category && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {issue.category}
              </span>
            )}
            <span className={`text-xs font-medium ${statusColors[issue.status]}`}>
              {issue.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
