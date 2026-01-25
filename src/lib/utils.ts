import type { PhaseType, PhaseCategory } from '../types';

// Format phone number for display
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Format date for display
export function formatDate(date: string | Date | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format date for relative display (e.g., "2 days ago")
export function formatRelativeDate(date: string | Date | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(date);
}

// Convert phase type to human-readable name
export function formatPhaseName(type: PhaseType | string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get phase category from type
export function getPhaseCategory(type: PhaseType | string): PhaseCategory {
  const categoryMap: Record<string, PhaseCategory> = {
    site_clearing: 'site_prep',
    pad_preparation: 'site_prep',
    utility_stub: 'site_prep',
    home_delivery: 'delivery',
    set_and_level: 'setup',
    blocking: 'setup',
    tie_downs: 'setup',
    marriage_line: 'setup',
    electrical_hookup: 'utilities',
    plumbing_hookup: 'utilities',
    hvac_startup: 'utilities',
    gas_hookup: 'utilities',
    septic_connect: 'utilities',
    well_connect: 'utilities',
    skirting: 'exterior',
    porch_steps: 'exterior',
    gutters: 'exterior',
    landscaping: 'exterior',
    driveway: 'exterior',
    flooring_completion: 'interior',
    trim_completion: 'interior',
    paint_touchup: 'interior',
    appliance_install: 'interior',
    county_inspection: 'inspection',
    final_inspection: 'inspection',
    walkthrough: 'service',
    punch_list: 'service',
    warranty_call: 'service',
    service_call: 'service',
  };
  return categoryMap[type] || 'service';
}

// Generate a temporary ID for offline items
export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check if an ID is a temporary (offline) ID
export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Capitalize first letter
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Class name utility (simple version of clsx)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
