// Organization Types
export type OrganizationType = 'dealership' | 'service_company' | 'subcontractor' | 'manufacturer';

export type SubscriptionTier = 'free_trial' | 'solo' | 'team' | 'dealership' | 'enterprise';

export interface OrgSettings {
  timezone: string;
  requirePhotos: boolean;
  requireSignatures: boolean;
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  parentOrgId?: string;
  settings: OrgSettings;
  subscription: SubscriptionTier;
  primaryEmail?: string;
  primaryPhone?: string;
  createdAt: string;
  updatedAt: string;
}

// User Types
export type UserRole = 'owner' | 'admin' | 'manager' | 'dispatcher' | 'technician' | 'viewer';

export type Permission =
  | 'properties.view'
  | 'properties.create'
  | 'properties.edit'
  | 'properties.delete'
  | 'phases.complete'
  | 'phases.assign'
  | 'users.manage'
  | 'reports.view'
  | 'settings.manage'
  | 'billing.manage';

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

// Customer Types
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

// Property Types
export type PropertyStatus =
  | 'pending_delivery'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'warranty_active'
  | 'closed';

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
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  sections?: number;
  soldDate?: string;
  deliveryDate?: string;
  targetCompletionDate?: string;
  actualCompletionDate?: string;
  moveInDate?: string;
  currentPhase?: string;
  overallStatus: PropertyStatus;
  dealershipId: string;
  createdByOrgId: string;
  createdByUserId?: string;
  tags?: string[];
  notes?: string;
  phases?: Phase[];
  issues?: Issue[];
  materialsLists?: MaterialsList[];
  portalCode?: string; // Unique shareable code for customer portal access
  createdAt: string;
  updatedAt: string;
}

// Phase Types
export type PhaseCategory =
  | 'site_prep'
  | 'delivery'
  | 'setup'
  | 'utilities'
  | 'exterior'
  | 'interior'
  | 'inspection'
  | 'service';

export type PhaseType =
  | 'site_clearing'
  | 'pad_preparation'
  | 'utility_stub'
  | 'home_delivery'
  | 'set_and_level'
  | 'blocking'
  | 'tie_downs'
  | 'marriage_line'
  | 'electrical_hookup'
  | 'plumbing_hookup'
  | 'hvac_startup'
  | 'gas_hookup'
  | 'septic_connect'
  | 'well_connect'
  | 'skirting'
  | 'porch_steps'
  | 'gutters'
  | 'landscaping'
  | 'driveway'
  | 'flooring_completion'
  | 'trim_completion'
  | 'paint_touchup'
  | 'appliance_install'
  | 'county_inspection'
  | 'final_inspection'
  | 'walkthrough'
  | 'punch_list'
  | 'warranty_call'
  | 'service_call';

export type PhaseStatus =
  | 'not_started'
  | 'scheduled'
  | 'in_progress'
  | 'on_hold'
  | 'blocked'
  | 'completed'
  | 'skipped';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

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

// Photo Types
export type PhotoType =
  | 'before'
  | 'during'
  | 'after'
  | 'issue'
  | 'receipt'
  | 'signature'
  | 'inspection'
  | 'general';

export type SyncStatus = 'synced' | 'pending' | 'uploading' | 'error';

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

// Issue Types
export type IssueCategory =
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'structural'
  | 'cosmetic'
  | 'appliance'
  | 'exterior'
  | 'safety'
  | 'other';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IssueStatus =
  | 'reported'
  | 'acknowledged'
  | 'in_progress'
  | 'pending_parts'
  | 'resolved'
  | 'wont_fix'
  | 'duplicate';

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
  receiptPhotoUrl?: string;
  notes?: string;
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
