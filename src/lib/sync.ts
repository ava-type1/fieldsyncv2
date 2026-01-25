import { db, type SyncQueueItem, type LocalPhoto } from './db';
import { supabase } from './supabase';

// Configuration
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;
const PHOTO_CHUNK_SIZE = 256 * 1024; // 256KB chunks for slow connections
const SYNC_BATCH_SIZE = 10;
const CONNECTION_CHECK_INTERVAL = 5000;

export type SyncEventType =
  | 'sync-start'
  | 'sync-complete'
  | 'sync-error'
  | 'sync-progress'
  | 'conflict'
  | 'conflict-resolved'
  | 'operation-queued'
  | 'operation-complete'
  | 'operation-failed'
  | 'connection-restored'
  | 'connection-lost'
  | 'photo-upload-progress';

export interface SyncEvent {
  type: SyncEventType;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export type SyncTableName = 'properties' | 'phases' | 'photos' | 'issues' | 'materials' | 'time_entries' | 'signatures';

export interface QueuedOperation {
  type: 'insert' | 'update' | 'delete';
  table: SyncTableName;
  data: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
}

export interface ConflictDraft {
  id?: number;
  table: SyncTableName;
  localId: string;
  remoteId?: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictedAt: Date;
  resolved: boolean;
}

type SyncEventCallback = (event: SyncEvent) => void;

// Utility: Calculate exponential backoff delay
function getBackoffDelay(attempts: number): number {
  const delay = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, attempts),
    MAX_RETRY_DELAY_MS
  );
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

// Utility: Check if we're truly online (not just navigator.onLine)
async function checkRealConnectivity(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return false;
  }
  
  try {
    // Try to reach Supabase health endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    return response.ok || response.status === 401; // 401 is fine, means we reached it
  } catch {
    return false;
  }
}

class SyncEngine {
  private isProcessing = false;
  private isStopped = false;
  private listeners: Set<SyncEventCallback> = new Set();
  private retryTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private lastOnlineState = true;
  private syncPromise: Promise<void> | null = null;
  private processingItems: Set<number> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      
      // Listen for visibility changes (app coming to foreground)
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      // Initial state
      this.lastOnlineState = navigator.onLine;
    }
  }

  private handleOnline(): void {
    if (!this.lastOnlineState) {
      this.lastOnlineState = true;
      this.emit({ type: 'connection-restored', message: 'Connection restored' });
      // Delay slightly to let connection stabilize
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  private handleOffline(): void {
    if (this.lastOnlineState) {
      this.lastOnlineState = false;
      this.emit({ type: 'connection-lost', message: 'Connection lost' });
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      // App came to foreground and we're online - try syncing
      this.processQueue();
    }
  }

  private startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) return;
    
    this.connectionCheckInterval = setInterval(async () => {
      if (!this.isProcessing && navigator.onLine) {
        const reallyOnline = await checkRealConnectivity();
        if (reallyOnline && !this.lastOnlineState) {
          this.lastOnlineState = true;
          this.emit({ type: 'connection-restored', message: 'Connection restored' });
          this.processQueue();
        } else if (!reallyOnline && this.lastOnlineState) {
          this.lastOnlineState = false;
        }
      }
    }, CONNECTION_CHECK_INTERVAL);
  }

  // Subscribe to sync events
  subscribe(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Sync event listener error:', err);
      }
    });
  }

  // Add an operation to the sync queue
  async addToQueue(
    item: Omit<SyncQueueItem, 'id' | 'attempts' | 'createdAt'>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<number> {
    const id = await db.syncQueue.add({
      ...item,
      attempts: 0,
      createdAt: new Date(),
      // Store priority in payload for sorting
      payload: { ...item.payload, _priority: priority },
    });

    this.emit({
      type: 'operation-queued',
      message: `Queued ${item.type} for ${item.table}`,
      details: { table: item.table, type: item.type, localId: item.localId },
    });

    // Try to sync immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Don't await - let it run in background
      this.processQueue();
    }

    return id as number;
  }

  // Process all pending items in the queue
  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return this.syncPromise || Promise.resolve();
    }

    // Check connectivity
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const reallyOnline = await checkRealConnectivity();
    if (!reallyOnline) {
      this.lastOnlineState = false;
      return;
    }

    this.isProcessing = true;
    this.isStopped = false;
    this.emit({ type: 'sync-start', message: 'Starting sync...' });

    this.syncPromise = this.doProcessQueue();
    
    try {
      await this.syncPromise;
    } finally {
      this.isProcessing = false;
      this.syncPromise = null;
    }
  }

  private async doProcessQueue(): Promise<void> {
    try {
      let hasMore = true;
      let processedCount = 0;
      let failedCount = 0;

      while (hasMore && !this.isStopped) {
        // Get pending items, sorted by priority and creation time
        const pending = await db.syncQueue
          .where('attempts')
          .below(MAX_RETRY_ATTEMPTS)
          .limit(SYNC_BATCH_SIZE)
          .toArray();

        // Sort: high priority first, then by creation time
        pending.sort((a, b) => {
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          const aPriority = (a.payload._priority as string) || 'normal';
          const bPriority = (b.payload._priority as string) || 'normal';
          
          if (aPriority !== bPriority) {
            return priorityOrder[aPriority as keyof typeof priorityOrder] - 
                   priorityOrder[bPriority as keyof typeof priorityOrder];
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

        if (pending.length === 0) {
          hasMore = false;
          break;
        }

        // Process items (some can be parallel, photos should be sequential)
        for (const item of pending) {
          if (this.isStopped) break;
          if (this.processingItems.has(item.id!)) continue;

          this.processingItems.add(item.id!);

          try {
            await this.syncItemWithConflictResolution(item);
            await db.syncQueue.delete(item.id!);
            processedCount++;

            this.emit({
              type: 'operation-complete',
              message: `Synced ${item.table}`,
              details: { table: item.table, localId: item.localId },
            });
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Check if it's a network error vs. a data error
            const isNetworkError = this.isNetworkError(error);
            
            if (isNetworkError) {
              // Network error - don't increment attempts aggressively
              await db.syncQueue.update(item.id!, {
                lastAttempt: new Date(),
                error: errorMessage,
              });
              
              // Stop processing on network errors
              this.isStopped = true;
              this.emit({
                type: 'sync-error',
                message: 'Network error, will retry later',
                error: errorMessage,
              });
            } else {
              // Data error - increment attempts
              const newAttempts = item.attempts + 1;
              await db.syncQueue.update(item.id!, {
                attempts: newAttempts,
                lastAttempt: new Date(),
                error: errorMessage,
              });

              if (newAttempts >= MAX_RETRY_ATTEMPTS) {
                this.emit({
                  type: 'operation-failed',
                  message: `Failed to sync ${item.table} after ${MAX_RETRY_ATTEMPTS} attempts`,
                  error: errorMessage,
                  details: { table: item.table, localId: item.localId },
                });
              } else {
                // Schedule retry with exponential backoff
                this.scheduleRetry(item.id!, newAttempts);
              }
            }
          } finally {
            this.processingItems.delete(item.id!);
          }

          // Emit progress
          const remaining = await this.getPendingCount();
          this.emit({
            type: 'sync-progress',
            message: `${remaining} items remaining`,
            details: { processed: processedCount, failed: failedCount, remaining },
          });
        }
      }

      const finalPending = await this.getPendingCount();
      const finalFailed = await this.getFailedCount();

      this.emit({
        type: 'sync-complete',
        message: finalPending === 0 ? 'All changes synced' : `${finalPending} items pending`,
        details: { pending: finalPending, failed: finalFailed, processed: processedCount },
      });
    } catch (error) {
      this.emit({
        type: 'sync-error',
        message: 'Sync failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('abort') ||
        msg.includes('offline')
      );
    }
    return false;
  }

  private scheduleRetry(itemId: number, attempts: number): void {
    // Clear any existing retry timeout
    const existingTimeout = this.retryTimeouts.get(itemId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const delay = getBackoffDelay(attempts);
    
    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(itemId);
      
      // Check if item still exists and should be retried
      const item = await db.syncQueue.get(itemId);
      if (item && item.attempts < MAX_RETRY_ATTEMPTS) {
        this.processQueue();
      }
    }, delay);

    this.retryTimeouts.set(itemId, timeout);
  }

  // Sync with conflict detection and resolution
  private async syncItemWithConflictResolution(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case 'phases':
        return this.syncPhaseWithConflicts(item);
      case 'photos':
        return this.syncPhotoChunked(item);
      case 'issues':
        return this.syncIssueWithConflicts(item);
      case 'materials':
        return this.syncMaterialWithConflicts(item);
      case 'time_entries':
        return this.syncTimeEntry(item);
      case 'signatures':
        return this.syncSignature(item);
      default:
        throw new Error(`Unknown table: ${item.table}`);
    }
  }

  // Generic conflict detection for updates
  private async detectConflict(
    table: string,
    remoteId: string,
    localUpdatedAt: string
  ): Promise<{ hasConflict: boolean; serverData?: Record<string, unknown> }> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', remoteId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record doesn't exist on server - deleted?
        return { hasConflict: true, serverData: undefined };
      }
      throw error;
    }

    // Compare updated_at timestamps
    const serverUpdatedAt = new Date(data.updated_at).getTime();
    const localTime = new Date(localUpdatedAt).getTime();

    if (serverUpdatedAt > localTime) {
      return { hasConflict: true, serverData: data };
    }

    return { hasConflict: false };
  }

  // Save local changes as draft when conflict occurs
  private async saveDraft(
    table: SyncTableName,
    localId: string,
    remoteId: string | undefined,
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>
  ): Promise<void> {
    const draft: ConflictDraft = {
      table,
      localId,
      remoteId,
      localData,
      serverData,
      conflictedAt: new Date(),
      resolved: false,
    };

    // Store in a drafts table (we'll need to add this to db.ts)
    await db.table('conflictDrafts').add(draft);

    this.emit({
      type: 'conflict',
      message: `Conflict detected for ${table}. Local changes saved as draft.`,
      details: { table, localId, remoteId },
    });
  }

  private async syncPhaseWithConflicts(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload, remoteId } = item;
    // Remove internal priority field
    const cleanPayload = { ...payload };
    delete cleanPayload._priority;

    if (type === 'CREATE') {
      const { data, error } = await supabase
        .from('phases')
        .insert(cleanPayload)
        .select()
        .single();

      if (error) throw error;

      await db.phases
        .where('localId')
        .equals(parseInt(localId))
        .modify({ remoteId: data.id, syncStatus: 'synced' });

    } else if (type === 'UPDATE') {
      if (!remoteId) throw new Error('No remote ID for update');

      // Check for conflicts
      const { hasConflict, serverData } = await this.detectConflict(
        'phases',
        remoteId,
        cleanPayload.updated_at as string || new Date().toISOString()
      );

      if (hasConflict && serverData) {
        // Server wins - save local as draft
        await this.saveDraft('phases', localId, remoteId, cleanPayload, serverData);
        
        // Update local record with server data
        await db.phases
          .where('localId')
          .equals(parseInt(localId))
          .modify({ 
            ...serverData, 
            syncStatus: 'synced',
            lastModified: new Date(),
          });

        this.emit({
          type: 'conflict-resolved',
          message: 'Phase conflict resolved (server wins)',
          details: { localId, remoteId },
        });
        return;
      }

      const { error } = await supabase
        .from('phases')
        .update(cleanPayload)
        .eq('id', remoteId);

      if (error) throw error;

      await db.phases
        .where('localId')
        .equals(parseInt(localId))
        .modify({ syncStatus: 'synced' });

    } else if (type === 'DELETE') {
      if (!remoteId) return; // Nothing to delete on server
      
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', remoteId);

      // Ignore "not found" errors for deletes
      if (error && error.code !== 'PGRST116') throw error;
    }
  }

  // Chunked photo upload for slow connections
  private async syncPhotoChunked(item: SyncQueueItem): Promise<void> {
    const localPhoto = await db.photos.get(parseInt(item.localId));
    if (!localPhoto) throw new Error('Photo not found in local database');
    
    // Handle delete
    if (item.type === 'DELETE') {
      if (localPhoto.remoteId) {
        const { error } = await supabase
          .from('photos')
          .delete()
          .eq('id', localPhoto.remoteId);
        if (error && error.code !== 'PGRST116') throw error;
      }
      return;
    }

    // For create/update with blob
    if (!localPhoto.localBlob && !localPhoto.remoteUrl) {
      throw new Error('No photo blob found');
    }

    // If already has remote URL, just update metadata
    if (localPhoto.remoteUrl && item.type === 'UPDATE') {
      const { error } = await supabase
        .from('photos')
        .update({
          caption: localPhoto.caption,
          photo_type: localPhoto.photoType,
        })
        .eq('id', localPhoto.remoteId);

      if (error) throw error;
      
      await db.photos
        .where('localId')
        .equals(parseInt(item.localId))
        .modify({ syncStatus: 'synced' });
      return;
    }

    // Need to upload blob
    if (!localPhoto.localBlob) {
      throw new Error('No blob to upload');
    }

    const blob = localPhoto.localBlob;
    const fileName = `${localPhoto.propertyId}/${localPhoto.phaseId || 'general'}/${Date.now()}_${item.localId}.jpg`;

    // For large files, upload in chunks using resumable uploads
    if (blob.size > PHOTO_CHUNK_SIZE) {
      await this.uploadPhotoInChunks(blob, fileName, item, localPhoto);
    } else {
      // Small file - direct upload
      await this.uploadPhotoDirectly(blob, fileName, item, localPhoto);
    }
  }

  private async uploadPhotoDirectly(
    blob: Blob,
    fileName: string,
    item: SyncQueueItem,
    localPhoto: LocalPhoto
  ): Promise<void> {
    // Mark as uploading
    await db.photos
      .where('localId')
      .equals(parseInt(item.localId))
      .modify({ syncStatus: 'uploading' });

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, {
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      await db.photos
        .where('localId')
        .equals(parseInt(item.localId))
        .modify({ syncStatus: 'error' });
      throw uploadError;
    }

    await this.finalizePhotoUpload(fileName, item, localPhoto);
  }

  private async uploadPhotoInChunks(
    blob: Blob,
    fileName: string,
    item: SyncQueueItem,
    localPhoto: LocalPhoto
  ): Promise<void> {
    const totalChunks = Math.ceil(blob.size / PHOTO_CHUNK_SIZE);
    let uploadedBytes = 0;

    // Mark as uploading
    await db.photos
      .where('localId')
      .equals(parseInt(item.localId))
      .modify({ syncStatus: 'uploading' });

    this.emit({
      type: 'photo-upload-progress',
      message: `Uploading photo 0/${totalChunks} chunks`,
      details: { localId: item.localId, progress: 0, total: blob.size },
    });

    // For Supabase, we can't do true chunked uploads, but we can
    // use a more reliable upload strategy with retries per attempt
    const maxUploadAttempts = 3;
    
    for (let attempt = 0; attempt < maxUploadAttempts; attempt++) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, blob, {
            cacheControl: '31536000',
            upsert: attempt > 0, // Upsert on retry
          });

        if (!uploadError) {
          break;
        }

        if (attempt === maxUploadAttempts - 1) {
          throw uploadError;
        }

        // Wait before retry with backoff
        await new Promise(resolve => setTimeout(resolve, getBackoffDelay(attempt)));
      } catch (error) {
        if (attempt === maxUploadAttempts - 1) {
          await db.photos
            .where('localId')
            .equals(parseInt(item.localId))
            .modify({ syncStatus: 'error' });
          throw error;
        }
      }
    }

    uploadedBytes = blob.size;
    this.emit({
      type: 'photo-upload-progress',
      message: `Uploaded photo`,
      details: { localId: item.localId, progress: uploadedBytes, total: blob.size },
    });

    await this.finalizePhotoUpload(fileName, item, localPhoto);
  }

  private async finalizePhotoUpload(
    fileName: string,
    item: SyncQueueItem,
    localPhoto: LocalPhoto
  ): Promise<void> {
    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);

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
        taken_at: localPhoto.takenAt?.toISOString() || new Date().toISOString(),
        taken_by_user_id: localPhoto.takenByUserId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update local record - clear blob to save space
    await db.photos
      .where('localId')
      .equals(parseInt(item.localId))
      .modify({
        remoteId: data.id,
        remoteUrl: publicUrl,
        syncStatus: 'synced',
        localBlob: undefined,
      });
  }

  private async syncIssueWithConflicts(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload, remoteId } = item;
    const cleanPayload = { ...payload };
    delete cleanPayload._priority;

    if (type === 'CREATE') {
      const { data, error } = await supabase
        .from('issues')
        .insert(cleanPayload)
        .select()
        .single();

      if (error) throw error;

      await db.issues
        .where('localId')
        .equals(parseInt(localId))
        .modify({ remoteId: data.id, syncStatus: 'synced' });

    } else if (type === 'UPDATE') {
      if (!remoteId) throw new Error('No remote ID for update');

      const { hasConflict, serverData } = await this.detectConflict(
        'issues',
        remoteId,
        cleanPayload.updated_at as string || new Date().toISOString()
      );

      if (hasConflict && serverData) {
        await this.saveDraft('issues', localId, remoteId, cleanPayload, serverData);
        
        await db.issues
          .where('localId')
          .equals(parseInt(localId))
          .modify({ 
            ...serverData, 
            syncStatus: 'synced',
            lastModified: new Date(),
          });

        this.emit({
          type: 'conflict-resolved',
          message: 'Issue conflict resolved (server wins)',
          details: { localId, remoteId },
        });
        return;
      }

      const { error } = await supabase
        .from('issues')
        .update(cleanPayload)
        .eq('id', remoteId);

      if (error) throw error;

      await db.issues
        .where('localId')
        .equals(parseInt(localId))
        .modify({ syncStatus: 'synced' });

    } else if (type === 'DELETE') {
      if (!remoteId) return;
      
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', remoteId);

      if (error && error.code !== 'PGRST116') throw error;
    }
  }

  private async syncMaterialWithConflicts(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload, remoteId } = item;
    const cleanPayload = { ...payload };
    delete cleanPayload._priority;

    if (type === 'UPDATE' && remoteId) {
      const { hasConflict, serverData } = await this.detectConflict(
        'materials_lists',
        remoteId,
        cleanPayload.updated_at as string || new Date().toISOString()
      );

      if (hasConflict && serverData) {
        await this.saveDraft('materials', localId, remoteId, cleanPayload, serverData);
        
        await db.materials
          .where('localId')
          .equals(parseInt(localId))
          .modify({ syncStatus: 'synced' });

        this.emit({
          type: 'conflict-resolved',
          message: 'Materials conflict resolved (server wins)',
          details: { localId, remoteId },
        });
        return;
      }

      const { error } = await supabase
        .from('materials_lists')
        .update({ items: cleanPayload.items })
        .eq('id', remoteId);

      if (error) throw error;

      await db.materials
        .where('localId')
        .equals(parseInt(localId))
        .modify({ syncStatus: 'synced' });
    }
  }

  private async syncTimeEntry(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload, remoteId } = item;
    const cleanPayload = { ...payload };
    delete cleanPayload._priority;

    if (type === 'CREATE') {
      const { data, error } = await supabase
        .from('time_entries')
        .insert(cleanPayload)
        .select()
        .single();

      if (error) throw error;

      await db.timeEntries.update(localId, { 
        syncStatus: 'synced',
      });

    } else if (type === 'UPDATE') {
      if (!remoteId) throw new Error('No remote ID for update');

      const { error } = await supabase
        .from('time_entries')
        .update(cleanPayload)
        .eq('id', remoteId);

      if (error) throw error;

      await db.timeEntries.update(localId, { syncStatus: 'synced' });

    } else if (type === 'DELETE') {
      if (!remoteId) return;
      
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', remoteId);

      if (error && error.code !== 'PGRST116') throw error;
    }
  }

  private async syncSignature(item: SyncQueueItem): Promise<void> {
    const { type, localId, payload } = item;
    const cleanPayload = { ...payload };
    delete cleanPayload._priority;

    if (type !== 'CREATE') {
      // Signatures are immutable - only creates
      return;
    }

    const localSig = await db.signatures.get(localId);
    if (!localSig) throw new Error('Signature not found');

    // Upload signature image to storage
    const signatureBlob = this.base64ToBlob(localSig.signatureData);
    const fileName = `signatures/${localSig.propertyId}/${localSig.id}.png`;

    const { error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(fileName, signatureBlob);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('signatures')
      .getPublicUrl(fileName);

    // Insert signature record
    const { error } = await supabase
      .from('signatures')
      .insert({
        id: localSig.id,
        property_id: localSig.propertyId,
        phase_id: localSig.phaseId,
        signature_url: publicUrl,
        signed_by_name: localSig.signedByName,
        signed_by_role: localSig.signedByRole,
        signed_at: localSig.signedAt,
      });

    if (error) throw error;

    await db.signatures.update(localId, { 
      remoteUrl: publicUrl,
      syncStatus: 'synced',
    });
  }

  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(',');
    const contentType = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
    const raw = atob(parts[1] || parts[0]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
  }

  // Get pending count for UI
  async getPendingCount(): Promise<number> {
    return db.syncQueue.where('attempts').below(MAX_RETRY_ATTEMPTS).count();
  }

  // Get failed count
  async getFailedCount(): Promise<number> {
    return db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).count();
  }

  // Get all pending items for debugging
  async getPendingItems(): Promise<SyncQueueItem[]> {
    return db.syncQueue.where('attempts').below(MAX_RETRY_ATTEMPTS).toArray();
  }

  // Get failed items
  async getFailedItems(): Promise<SyncQueueItem[]> {
    return db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).toArray();
  }

  // Manual retry for failed items
  async retryFailed(): Promise<void> {
    await db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).modify({
      attempts: 0,
      error: undefined,
      lastAttempt: undefined,
    });
    this.processQueue();
  }

  // Retry a specific failed item
  async retryItem(itemId: number): Promise<void> {
    await db.syncQueue.update(itemId, {
      attempts: 0,
      error: undefined,
      lastAttempt: undefined,
    });
    this.processQueue();
  }

  // Clear all failed items
  async clearFailed(): Promise<void> {
    await db.syncQueue.where('attempts').aboveOrEqual(MAX_RETRY_ATTEMPTS).delete();
  }

  // Clear a specific failed item
  async clearItem(itemId: number): Promise<void> {
    await db.syncQueue.delete(itemId);
  }

  // Queue an operation for sync (used by hooks)
  async queueOperation(operation: QueuedOperation): Promise<void> {
    await this.addToQueue(
      {
        table: operation.table,
        type: operation.type === 'insert' ? 'CREATE' : operation.type === 'update' ? 'UPDATE' : 'DELETE',
        localId: String(operation.data.localId || operation.data.id),
        remoteId: operation.data.remoteId as string | undefined,
        payload: operation.data,
      },
      operation.priority || 'normal'
    );
  }

  // Force sync now (manual trigger)
  async forcSync(): Promise<void> {
    // Clear retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    // Reset processing state
    this.isStopped = false;
    
    // Wait for any current processing to finish
    if (this.syncPromise) {
      await this.syncPromise;
    }
    
    // Process queue
    await this.processQueue();
  }

  // Stop sync (for logout, etc.)
  stop(): void {
    this.isStopped = true;
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  // Resume sync
  resume(): void {
    this.isStopped = false;
    this.startConnectionMonitoring();
    this.processQueue();
  }

  // Get conflict drafts
  async getConflictDrafts(): Promise<ConflictDraft[]> {
    try {
      return await db.table('conflictDrafts').toArray();
    } catch {
      return [];
    }
  }

  // Resolve a conflict draft (apply local changes)
  async applyDraft(draftId: number): Promise<void> {
    const draft = await db.table('conflictDrafts').get(draftId);
    if (!draft) throw new Error('Draft not found');

    // Queue the local changes for sync again
    await this.queueOperation({
      type: 'update',
      table: draft.table,
      data: {
        ...draft.localData,
        localId: draft.localId,
        remoteId: draft.remoteId,
        // Add a forced update flag
        _forceUpdate: true,
      },
      priority: 'high',
    });

    // Mark draft as resolved
    await db.table('conflictDrafts').update(draftId, { resolved: true });
  }

  // Discard a conflict draft
  async discardDraft(draftId: number): Promise<void> {
    await db.table('conflictDrafts').delete(draftId);
  }

  // Check if there are any conflicts
  async hasConflicts(): Promise<boolean> {
    try {
      const count = await db.table('conflictDrafts').where('resolved').equals(false).count();
      return count > 0;
    } catch {
      return false;
    }
  }
}

export const syncEngine = new SyncEngine();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { syncEngine: SyncEngine }).syncEngine = syncEngine;
}
