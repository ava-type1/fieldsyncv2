# Mobile-First UI Patterns for FieldSync

## Core Principles

1. **Large Touch Targets** - Minimum 44x44px for all interactive elements
2. **Bottom Navigation** - Primary actions within thumb reach
3. **Clear Visual Hierarchy** - Most important info visible without scrolling
4. **Fast Loading States** - Skeleton screens over spinners
5. **Offline Indicators** - Always show sync status

## Tailwind Config
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
};
```

## Layout Components

### App Shell
```tsx
// src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SyncStatus } from '../SyncStatus';

export function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-900">FieldSync</h1>
        <SyncStatus />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
```

### Bottom Navigation
```tsx
// src/components/layout/BottomNav.tsx
import { NavLink } from 'react-router-dom';
import { Home, MapPin, ClipboardList, User } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Jobs' },
  { to: '/map', icon: MapPin, label: 'Map' },
  { to: '/materials', icon: ClipboardList, label: 'Materials' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t pb-safe-bottom">
      <div className="flex justify-around">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center py-3 px-4 min-w-[64px] ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs mt-1">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

## Common UI Components

### Card
```tsx
// src/components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 p-4
        ${onClick ? 'active:bg-gray-50 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

### Button
```tsx
// src/components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-base min-h-[44px]', // 44px minimum touch target
    lg: 'px-6 py-4 text-lg min-h-[52px]',
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  );
}
```

### Input
```tsx
// src/components/ui/Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-3 rounded-lg border
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

### Textarea
```tsx
// src/components/ui/Textarea.tsx
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-4 py-3 rounded-lg border resize-none
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}
        `}
        rows={4}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

## Job-Specific Components

### Job Card (List View)
```tsx
// src/components/jobs/JobCard.tsx
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Calendar, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';

interface JobCardProps {
  job: {
    id: string;
    customer: {
      name: string;
      phone: string;
      street: string;
      city: string;
    };
    status: string;
    type: string;
    scheduledDate?: Date;
    syncStatus: string;
  };
}

const statusColors = {
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  pending_return: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
};

export function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate();

  return (
    <Card onClick={() => navigate(`/job/${job.id}`)} className="relative">
      {/* Sync indicator */}
      {job.syncStatus === 'pending' && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full" />
      )}

      {/* Customer Name */}
      <h3 className="font-semibold text-gray-900 text-lg">
        {job.customer.name}
      </h3>

      {/* Address */}
      <div className="flex items-center gap-2 mt-2 text-gray-600">
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm truncate">
          {job.customer.street}, {job.customer.city}
        </span>
      </div>

      {/* Phone */}
      <div className="flex items-center gap-2 mt-1 text-gray-600">
        <Phone className="w-4 h-4 flex-shrink-0" />
        <a 
          href={`tel:${job.customer.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-primary-600"
        >
          {job.customer.phone}
        </a>
      </div>

      {/* Bottom row: Status, Date, Arrow */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status] || 'bg-gray-100'}`}>
          {job.status.replace('_', ' ')}
        </span>
        
        {job.scheduledDate && (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            {new Date(job.scheduledDate).toLocaleDateString()}
          </div>
        )}
        
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </Card>
  );
}
```

### Photo Grid
```tsx
// src/components/photos/PhotoGrid.tsx
import { Camera, X } from 'lucide-react';

interface PhotoGridProps {
  photos: Array<{ id: string; localUri?: string; remoteUrl?: string; syncStatus: string }>;
  onCapture: () => void;
  onRemove?: (id: string) => void;
}

export function PhotoGrid({ photos, onCapture, onRemove }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          <img
            src={photo.localUri || photo.remoteUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          
          {/* Sync status overlay */}
          {photo.syncStatus === 'pending' && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="text-white text-xs">Uploading...</span>
            </div>
          )}
          
          {/* Remove button */}
          {onRemove && (
            <button
              onClick={() => onRemove(photo.id)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      ))}
      
      {/* Add photo button */}
      <button
        onClick={onCapture}
        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors"
      >
        <Camera className="w-8 h-8" />
        <span className="text-xs mt-1">Add Photo</span>
      </button>
    </div>
  );
}
```

### Materials Checklist
```tsx
// src/components/materials/MaterialsChecklist.tsx
import { Plus, Check, ShoppingCart } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  purchased: boolean;
}

interface MaterialsChecklistProps {
  materials: Material[];
  onAdd: (name: string, quantity: number, unit: string) => void;
  onToggle: (id: string) => void;
}

export function MaterialsChecklist({ materials, onAdd, onToggle }: MaterialsChecklistProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('each');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim(), quantity, unit);
      setName('');
      setQuantity(1);
      setAdding(false);
    }
  };

  const unpurchased = materials.filter(m => !m.purchased);
  const purchased = materials.filter(m => m.purchased);

  return (
    <div className="space-y-4">
      {/* Needed section */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Needed ({unpurchased.length})
        </h3>
        
        <div className="space-y-2">
          {unpurchased.map((m) => (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border text-left"
            >
              <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              <div className="flex-1">
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-gray-500">{m.quantity} {m.unit}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Purchased section */}
      {purchased.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-500 mb-2 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Purchased ({purchased.length})
          </h3>
          
          <div className="space-y-2">
            {purchased.map((m) => (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg border text-left"
              >
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 opacity-60">
                  <p className="font-medium line-through">{m.name}</p>
                  <p className="text-sm text-gray-500">{m.quantity} {m.unit}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add material form */}
      {adding ? (
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <Input
            placeholder="Material name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-20"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
            >
              <option value="each">each</option>
              <option value="ft">feet</option>
              <option value="box">box</option>
              <option value="roll">roll</option>
              <option value="bag">bag</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAdding(false)} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleAdd} fullWidth>
              Add
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)} fullWidth>
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      )}
    </div>
  );
}
```

## Skeleton Loading States

```tsx
// src/components/ui/Skeleton.tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between pt-3 border-t">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}
```

## Pull to Refresh

```tsx
// src/hooks/usePullToRefresh.ts
import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY > 80 && container.scrollTop === 0 && !refreshing) {
        setRefreshing(true);
        onRefresh().finally(() => setRefreshing(false));
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [onRefresh, refreshing]);

  return { containerRef, refreshing };
}
```
