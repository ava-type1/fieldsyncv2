import { db, type SyncQueueItem } from './db';
import { supabase } from './supabase';

const MAX_RETRY_ATTEMPTS = 3;

export type SyncEventType =
  | 'sync-start'
  | 'sync-complete'
  | 'sync-error'
  | 'conflict'
  | 'operation-queued'
  | 'operation-complete'
  | 'operation-failed';

export interface SyncEvent {
  type: SyncEventType;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export type SyncTableName = 'properties' | 'phases' | 'photos' | 'issues' | 'materials';

export interface QueuedOperation {
  type: 'insert' | 'update' | 'delete';
  table: SyncTableName;
  data: Record<string, unknown>;
}

type SyncEventCallback = (event: SyncEvent) => void;

class SyncEngine {
  private isProcessing = false;
  private listeners: Set<SyncEventCallback> = new Set();

  constructor() {
    // Auto-sync when coming online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  // Subscribe to sync events
  subscribe(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }

  // Add an operation to the sync queue
  async addToQueue(
    item: Omit<SyncQueueItem, 'id' | 'attempts' | 'createdAt'>
  ): Promise<number> {
    const id = await db.syncQueue.add({
      ...item,
      attempts: 0,
      createdAt: new Date(),
    });

    // Try to sync immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue();
    }

    return id as number;
  }

  // Process all pending items in the queue
  async processQueue(): Promise<void> {
    if (this.isProcessing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }

    this.isProcessing = true;
    this.emit({ type: 'sync-start', message: 'Starting sync...' });

    try {
      const pending = await db.syncQueue
        .where('attempts')
        .below(MAX_RETRY_ATTEMPTS)
        .toArray();

      for (const item of pending) {
        try {
          await this.syncItem(item);
          await db.syncQueue.delete(item.id!);
        } catch (error) {
          // Increment attempts and record error
          await db.syncQueue.update(item.id!, {
            attempts: item.attempts + 1,
            lastAttempt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          this.emit({
            type: 'sync-error',
            message: `Failed to sync ${item.table}`,
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
          });
        }
      }

      this.emit({ type: 'sync-complete', message: 'Sync complete' });
    } finally {
      this.isProcessing = false;
    }
  }

  // Sync a single item
  private async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case 'phases':
        return this.syncPhase(item);
      case 'photos':
        return this.syncPhoto(item);
      case 'issues':
        return this.syncIssue(item);
      case 'materials':
        return this.syncMaterial(item);
      default:
        throw new Error(`Unknown table: ${item.table}`);
    }
  }

  private async syncPhase(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload, remoteId } = item;

    if (type === 'CREATE') {
      const { data, error } = await supabase
        .from('phases')
        .insert(payload as Record<string, unknown>)
        .select()
        .single();

      if (error) throw error;

      // Update local record with remote ID
      await db.phases
        .where('localId')
        .equals(parseInt(localId))
        .modify({ remoteId: data.id, syncStatus: 'synced' });
    } else if (type === 'UPDATE') {
      if (!remoteId) throw new Error('No remote ID for update');

      const { error } = await supabase
        .from('phases')
        .update(payload as Record<string, unknown>)
        .eq('id', remoteId);

      if (error) throw error;

      await db.phases
        .where('localId')
        .equals(parseInt(localId))
        .modify({ syncStatus: 'synced' });
    }
  }

  private async syncPhoto(item: SyncQueueItem): Promise<void> {
    const localPhoto = await db.photos.get(parseInt(item.localId));
    if (!localPhoto?.localBlob) throw new Error('No photo blob found');

    // Upload to Supabase Storage
    const fileName = `${localPhoto.propertyId}/${localPhoto.phaseId || 'general'}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, localPhoto.localBlob);

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(fileName);

    // Insert photo record
    const { data, error } = await supabase
      .from('photos')
      .insert({
        property_id: localPhoto.propertyId,
        phase_id: localPhoto.phaseId,
        issue_id: localPhoto.issueId,
        url: publicUrl,
        caption: localPhoto.caption,
        photo_type: localPhoto.photoType,
        taken_at: localPhoto.takenAt,
        taken_by_user_id: localPhoto.takenByUserId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update local record
    await db.photos
      .where('localId')
      .equals(parseInt(item.localId))
      .modify({
        remoteId: data.id,
        remoteUrl: publicUrl,
        syncStatus: 'synced',
        localBlob: undefined, // Clear blob to save space
      });
  }

  private async syncIssue(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload, remoteId } = item;

    if (type === 'CREATE') {
      const { data, error } = await supabase
        .from('issues')
        .insert(payload as Record<string, unknown>)
        .select()
        .single();

      if (error) throw error;

      await db.issues
        .where('localId')
        .equals(parseInt(localId))
        .modify({ remoteId: data.id, syncStatus: 'synced' });
    } else if (type === 'UPDATE') {
      if (!remoteId) throw new Error('No remote ID for update');

      const { error } = await supabase
        .from('issues')
        .update(payload as Record<string, unknown>)
        .eq('id', remoteId);

      if (error) throw error;

      await db.issues
        .where('localId')
        .equals(parseInt(localId))
        .modify({ syncStatus: 'synced' });
    }
  }

  private async syncMaterial(item: SyncQueueItem): Promise<void> {
    // Materials are stored as JSONB in materials_lists, so syncing is more complex
    // For now, we'll sync the entire materials list
    const { type, localId, payload, remoteId } = item;

    if (type === 'UPDATE' && remoteId) {
      const { error } = await supabase
        .from('materials_lists')
        .update({ items: payload.items })
        .eq('id', remoteId);

      if (error) throw error;

      await db.materials
        .where('localId')
        .equals(parseInt(localId))
        .modify({ syncStatus: 'synced' });
    }
  }

  // Get pending count for UI
  async getPendingCount(): Promise<number> {
    return db.syncQueue.count();
  }

  // Manual retry for failed items
  async retryFailed(): Promise<void> {
    await db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).modify({
      attempts: 0,
      error: undefined,
    });
    this.processQueue();
  }

  // Clear all failed items
  async clearFailed(): Promise<void> {
    await db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).delete();
  }

  // Get count of failed items
  async getFailedCount(): Promise<number> {
    return db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).count();
  }

  // Queue an operation for sync (used by hooks)
  async queueOperation(operation: QueuedOperation): Promise<void> {
    this.emit({ type: 'operation-queued', details: { ...operation } });

    await this.addToQueue({
      table: operation.table,
      type: operation.type === 'insert' ? 'CREATE' : operation.type === 'update' ? 'UPDATE' : 'DELETE',
      localId: operation.data.id as string,
      payload: operation.data,
    });
  }
}

export const syncEngine = new SyncEngine();

// Make available globally for debugging in development
if (typeof window !== 'undefined') {
  (window as unknown as { syncEngine: SyncEngine }).syncEngine = syncEngine;
}
