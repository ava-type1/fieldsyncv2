import { cn } from '../../lib/utils';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message = 'Loading...', className }: LoadingScreenProps) {
  return (
    <div className={cn(
      'min-h-screen flex flex-col items-center justify-center bg-gray-50',
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        {/* Logo */}
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>

        {/* Spinner */}
        <div className="relative">
          <div className="w-8 h-8 border-4 border-blue-200 rounded-full" />
          <div className="absolute top-0 left-0 w-8 h-8 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
        </div>

        {/* Message */}
        <p className="text-sm text-gray-500 animate-pulse">{message}</p>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 border-4 border-blue-200 rounded-full" />
          <div className="absolute top-0 left-0 w-10 h-10 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
        </div>
        {message && (
          <p className="text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-4',
  };

  return (
    <div className={cn('relative', className)}>
      <div className={cn('border-gray-200 rounded-full', sizeClasses[size])} />
      <div className={cn(
        'absolute top-0 left-0 border-blue-600 rounded-full border-t-transparent animate-spin',
        sizeClasses[size]
      )} />
    </div>
  );
}
