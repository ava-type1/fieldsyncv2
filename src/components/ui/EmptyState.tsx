import { 
  Home, 
  FileText, 
  Camera, 
  AlertCircle, 
  Clock, 
  Search,
  Inbox,
  FolderOpen
} from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

type EmptyStateIcon = 'home' | 'document' | 'photo' | 'alert' | 'clock' | 'search' | 'inbox' | 'folder';

interface EmptyStateProps {
  icon?: EmptyStateIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const iconComponents: Record<EmptyStateIcon, React.ReactNode> = {
  home: <Home className="w-12 h-12" />,
  document: <FileText className="w-12 h-12" />,
  photo: <Camera className="w-12 h-12" />,
  alert: <AlertCircle className="w-12 h-12" />,
  clock: <Clock className="w-12 h-12" />,
  search: <Search className="w-12 h-12" />,
  inbox: <Inbox className="w-12 h-12" />,
  folder: <FolderOpen className="w-12 h-12" />,
};

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
        {iconComponents[icon]}
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Specific empty states for common scenarios
export function NoProperties({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon="home"
      title="No properties yet"
      description="Add your first property to start tracking phases and managing work."
      action={onAdd ? { label: 'Add Property', onClick: onAdd } : undefined}
    />
  );
}

export function NoPhotos({ onCapture }: { onCapture?: () => void }) {
  return (
    <EmptyState
      icon="photo"
      title="No photos"
      description="Capture photos to document your work and keep a visual record."
      action={onCapture ? { label: 'Take Photo', onClick: onCapture } : undefined}
    />
  );
}

export function NoIssues() {
  return (
    <EmptyState
      icon="alert"
      title="No issues reported"
      description="Great news! No issues have been reported for this property."
    />
  );
}

export function NoResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={query ? `No matches for "${query}". Try a different search.` : 'Try adjusting your filters.'}
    />
  );
}

export function NoTimeEntries({ onStart }: { onStart?: () => void }) {
  return (
    <EmptyState
      icon="clock"
      title="No time entries"
      description="Start tracking your time to keep accurate records for billing."
      action={onStart ? { label: 'Start Timer', onClick: onStart } : undefined}
    />
  );
}
