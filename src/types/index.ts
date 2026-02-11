// ============================================
// FieldSync v2 — Personal Use (Kam's App)
// ============================================

// Job Types for Nobility Homes contracting
export type JobType = 'walkthrough' | 'work_order';

export type JobStatus = 'active' | 'in_progress' | 'completed' | 'on_hold';

export interface Job {
  id: string;
  jobType: JobType;
  status: JobStatus;
  
  // Customer info (from scanned paperwork)
  customerName: string;
  phone?: string;
  workPhone?: string;
  cellPhone?: string;
  
  // Address
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  
  // Nobility specifics
  serialNumber?: string;
  poNumber?: string;
  model?: string;
  lotNumber?: string;
  salesperson?: string;
  setupBy?: string;
  
  // Work details
  notes?: string;
  
  // Photo documentation
  photos: JobPhoto[];
  
  // Materials tracking
  materials: Material[];
  
  // Signatures
  signatures: Signature[];
  
  // Checklist items (for walkthroughs)
  checklistItems: ChecklistItem[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JobPhoto {
  id: string;
  jobId: string;
  dataUrl?: string;      // For offline storage (base64)
  remoteUrl?: string;     // After upload to Supabase
  caption?: string;
  photoType: 'before' | 'during' | 'after' | 'issue' | 'receipt' | 'general';
  takenAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

// Materials Types
export type MaterialCategory =
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'lumber'
  | 'hardware'
  | 'trim'
  | 'paint'
  | 'flooring'
  | 'other';

export type MaterialStatus = 'needed' | 'ordered' | 'purchased' | 'on_site' | 'installed';

export interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: MaterialCategory;
  estimatedUnitCost?: number;
  actualUnitCost?: number;
  status: MaterialStatus;
  purchasedFrom?: string;
  purchasedAt?: string;
  notes?: string;
}

// Signature Types
export interface Signature {
  id: string;
  jobId: string;
  signatureData: string; // base64
  signedByName: string;
  signedByRole: 'customer' | 'technician';
  signedAt: string;
}

// Pay tracking
export interface PayEntry {
  id: string;
  date: string;
  dateEnd?: string;
  type: 'walkthrough' | 'return' | 'windshield';
  milesOneWay: number;
  trips: number;
  hours?: number;
  customerName?: string;
  poNumber?: string;
  serialNumber?: string;
  address?: string;
  notes?: string;
  jobId?: string; // Link to a job
}

// Time tracking
export interface TimeEntry {
  id: string;
  jobId?: string;
  startTime: string;
  endTime?: string;
  pausedDuration: number;
  totalDuration?: number;
  hourlyRate: number;
  mileage?: number;
  mileageRate: number;
  earnings?: number;
  notes?: string;
  createdAt: string;
}

// Sync status for offline support
export type SyncStatus = 'synced' | 'pending' | 'uploading' | 'error';

// ============================================
// Legacy types kept for compatibility
// ============================================
export type UserRole = 'owner' | 'admin' | 'manager' | 'dispatcher' | 'technician' | 'viewer';
export type Permission = string;

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  organizationId: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  settings: Record<string, any>;
  subscription: string;
  createdAt: string;
  updatedAt: string;
}

// Legacy types needed by existing components
export type PropertyStatus = 'pending_delivery' | 'in_progress' | 'on_hold' | 'completed' | 'warranty_active' | 'closed';

export interface Customer {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  preferredContact: 'phone' | 'text' | 'email';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  lat?: number;
  lng?: number;
  customerId: string;
  customer?: Customer;
  manufacturer: string;
  model?: string;
  serialNumber?: string;
  overallStatus: PropertyStatus;
  currentPhase?: string;
  dealershipId: string;
  createdByOrgId: string;
  createdByUserId?: string;
  tags?: string[];
  notes?: string;
  phases?: Phase[];
  issues?: Issue[];
  materialsLists?: MaterialsList[];
  portalCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type PhaseCategory = 'site_prep' | 'delivery' | 'setup' | 'utilities' | 'exterior' | 'interior' | 'inspection' | 'service';
export type PhaseType = string;
export type PhaseStatus = 'not_started' | 'scheduled' | 'in_progress' | 'on_hold' | 'blocked' | 'completed' | 'skipped';

export interface Phase {
  id: string;
  propertyId: string;
  type: PhaseType;
  category: PhaseCategory;
  sortOrder: number;
  status: PhaseStatus;
  assignedOrgId?: string;
  assignedOrg?: Organization;
  assignedUserId?: string;
  assignedUser?: User;
  scheduledDate?: string;
  scheduledTimeWindow?: string;
  estimatedDuration?: number;
  startedAt?: string;
  completedAt?: string;
  completedByUserId?: string;
  notes?: string;
  checklistItems: ChecklistItem[];
  photos?: Photo[];
  issues?: Issue[];
  customerSignatureUrl?: string;
  customerSignedAt?: string;
  technicianSignatureUrl?: string;
  technicianSignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PhotoType = 'before' | 'during' | 'after' | 'issue' | 'receipt' | 'signature' | 'inspection' | 'general';

export interface Photo {
  id: string;
  propertyId: string;
  phaseId?: string;
  issueId?: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  photoType: PhotoType;
  takenAt: string;
  takenByUserId?: string;
  lat?: number;
  lng?: number;
  localUri?: string;
  syncStatus?: SyncStatus;
  createdAt: string;
}

export type IssueCategory = 'electrical' | 'plumbing' | 'hvac' | 'structural' | 'cosmetic' | 'appliance' | 'exterior' | 'safety' | 'other';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'reported' | 'acknowledged' | 'in_progress' | 'pending_parts' | 'resolved' | 'wont_fix' | 'duplicate';

export interface Issue {
  id: string;
  propertyId: string;
  phaseId?: string;
  title: string;
  description?: string;
  category?: IssueCategory;
  severity: IssueSeverity;
  reportedByUserId: string;
  reportedByOrgId: string;
  assignedToOrgId?: string;
  assignedToUserId?: string;
  status: IssueStatus;
  photos?: Photo[];
  resolution?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialsList {
  id: string;
  propertyId: string;
  phaseId?: string;
  createdByUserId: string;
  items: Material[];
  totalEstimatedCost?: number;
  totalActualCost?: number;
  createdAt: string;
  updatedAt: string;
}
