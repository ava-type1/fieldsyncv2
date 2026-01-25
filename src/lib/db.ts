import Dexie, { type Table } from 'dexie';
import type {
  Property,
  Customer,
  Phase,
  Issue,
  Material,
  SyncStatus,
} from '../types';

// Local versions with sync tracking
export interface LocalProperty extends Property {
  localId?: number;
  remoteId?: string;
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalCustomer extends Customer {
  localId?: number;
  remoteId?: string;
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalPhase extends Phase {
  localId?: number;
  remoteId?: string;
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalPhoto {
  localId?: number;
  remoteId?: string;
  propertyId: string;
  phaseId?: string;
  issueId?: string;
  localBlob?: Blob;
  localUri?: string;
  remoteUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  photoType: string;
  takenAt: Date;
  takenByUserId?: string;
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalIssue extends Issue {
  localId?: number;
  remoteId?: string;
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalMaterial extends Material {
  localId?: number;
  propertyId: string;
  materialsListId?: string;
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalMaterialsList {
  id: string;
  propertyId: string;
  items: Material[];
  property?: { id: string; street: string; city: string };
  syncStatus: SyncStatus;
  lastModified: Date;
}

export interface LocalTimeEntry {
  id: string;
  propertyId: string;
  phaseId?: string;
  userId: string;
  startTime: string;
  endTime?: string;
  pausedDuration: number;
  totalDuration?: number;
  hourlyRate: number;
  mileage?: number;
  mileageRate: number;
  earnings?: number;
  lat?: number;
  lng?: number;
  notes?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSignature {
  id: string;
  propertyId: string;
  phaseId?: string;
  signatureData: string; // base64
  signedByName: string;
  signedByRole: 'customer' | 'technician' | 'manager';
  signedAt: string;
  remoteUrl?: string;
  syncStatus: SyncStatus;
  createdAt: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: 'properties' | 'phases' | 'photos' | 'issues' | 'materials' | 'time_entries' | 'signatures';
  localId: string;
  remoteId?: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  createdAt: Date;
}

export interface ConflictDraft {
  id?: number;
  table: 'properties' | 'phases' | 'photos' | 'issues' | 'materials' | 'time_entries' | 'signatures';
  localId: string;
  remoteId?: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictedAt: Date;
  resolved: boolean;
}

class FieldSyncDB extends Dexie {
  properties!: Table<LocalProperty>;
  customers!: Table<LocalCustomer>;
  phases!: Table<LocalPhase>;
  photos!: Table<LocalPhoto>;
  issues!: Table<LocalIssue>;
  materials!: Table<LocalMaterial>;
  materials_lists!: Table<LocalMaterialsList>;
  timeEntries!: Table<LocalTimeEntry>;
  signatures!: Table<LocalSignature>;
  syncQueue!: Table<SyncQueueItem>;
  conflictDrafts!: Table<ConflictDraft>;

  constructor() {
    super('FieldSyncDB');

    this.version(2).stores({
      properties: '++localId, remoteId, customerId, dealershipId, overallStatus, syncStatus',
      customers: '++localId, remoteId, organizationId, phone, syncStatus',
      phases: '++localId, remoteId, propertyId, type, status, syncStatus',
      photos: '++localId, remoteId, propertyId, phaseId, issueId, syncStatus',
      issues: '++localId, remoteId, propertyId, phaseId, status, syncStatus',
      materials: '++localId, propertyId, materialsListId, status, syncStatus',
      materials_lists: 'id, propertyId, syncStatus',
      timeEntries: 'id, propertyId, phaseId, userId, startTime, syncStatus',
      signatures: 'id, propertyId, phaseId, signedByRole, syncStatus',
      syncQueue: '++id, type, table, localId, createdAt',
    });

    // Version 3: Add conflict drafts table for offline conflict resolution
    this.version(3).stores({
      properties: '++localId, remoteId, customerId, dealershipId, overallStatus, syncStatus',
      customers: '++localId, remoteId, organizationId, phone, syncStatus',
      phases: '++localId, remoteId, propertyId, type, status, syncStatus',
      photos: '++localId, remoteId, propertyId, phaseId, issueId, syncStatus',
      issues: '++localId, remoteId, propertyId, phaseId, status, syncStatus',
      materials: '++localId, propertyId, materialsListId, status, syncStatus',
      materials_lists: 'id, propertyId, syncStatus',
      timeEntries: 'id, propertyId, phaseId, userId, startTime, syncStatus',
      signatures: 'id, propertyId, phaseId, signedByRole, syncStatus',
      syncQueue: '++id, type, table, localId, attempts, createdAt',
      conflictDrafts: '++id, table, localId, remoteId, resolved, conflictedAt',
    });
  }
}

export const db = new FieldSyncDB();

// Helper to clear all local data (useful for logout)
export async function clearLocalData(): Promise<void> {
  await db.properties.clear();
  await db.customers.clear();
  await db.phases.clear();
  await db.photos.clear();
  await db.issues.clear();
  await db.materials.clear();
  await db.timeEntries.clear();
  await db.signatures.clear();
  await db.syncQueue.clear();
  await db.conflictDrafts.clear();
}

// Helper to get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  return db.syncQueue.count();
}
