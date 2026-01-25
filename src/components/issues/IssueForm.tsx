import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuthStore } from '../../stores/authStore';
import type { Issue, IssueCategory, IssueSeverity } from '../../types';

interface IssueFormProps {
  propertyId: string;
  onSubmit: (issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

const categories: { value: IssueCategory; label: string }[] = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'structural', label: 'Structural' },
  { value: 'cosmetic', label: 'Cosmetic' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

const severities: { value: IssueSeverity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

export function IssueForm({ propertyId, onSubmit, onClose }: IssueFormProps) {
  const { user, organization } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('other');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user || !organization) return;

    onSubmit({
      propertyId,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      severity,
      reportedByUserId: user.id,
      reportedByOrgId: organization.id,
      status: 'reported',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Add Issue</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Title */}
          <Input
            label="Issue Title"
            placeholder="e.g., Leaking faucet in kitchen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <div className="grid grid-cols-4 gap-2">
              {severities.map((sev) => (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => setSeverity(sev.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    severity === sev.value
                      ? sev.color + ' ring-2 ring-offset-1 ring-gray-400'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details about the issue..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={!title.trim()}>
              Add Issue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
