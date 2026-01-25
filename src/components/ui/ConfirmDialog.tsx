import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

type DialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  loading?: boolean;
  icon?: 'delete' | 'logout' | 'warning';
}

const variantStyles: Record<DialogVariant, { bg: string; button: string }> = {
  danger: {
    bg: 'bg-red-100',
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  warning: {
    bg: 'bg-yellow-100',
    button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
  },
  info: {
    bg: 'bg-blue-100',
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  },
};

const icons = {
  delete: <Trash2 className="w-6 h-6 text-red-600" />,
  logout: <LogOut className="w-6 h-6 text-red-600" />,
  warning: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  icon = 'warning',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          {/* Icon */}
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto', styles.bg)}>
            {icons[icon]}
          </div>

          {/* Content */}
          <div className="mt-4 text-center">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              className={cn('flex-1', styles.button)}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Please wait...' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
import { useState, useCallback } from 'react';

interface UseConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  variant?: DialogVariant;
  icon?: 'delete' | 'logout' | 'warning';
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<UseConfirmOptions | null>(null);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: UseConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(false);
  }, [resolveRef]);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(true);
  }, [resolveRef]);

  const ConfirmDialogComponent = options ? (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      variant={options.variant}
      icon={options.icon}
    />
  ) : null;

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
