# Offline PWA Patterns for FieldSync

## PWA Setup with Vite

### Install Dependencies
```bash
npm install vite-plugin-pwa workbox-window dexie
```

### Vite Config
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'FieldSync',
        short_name: 'FieldSync',
        description: 'Field service management for contractors',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API calls - network first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Images - cache first
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Supabase storage (photos) - stale while revalidate
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'photo-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ]
});
```

## IndexedDB with Dexie

### Database Setup
```typescript
// src/lib/db.ts
import Dexie, { type Table } from 'dexie';

export interface LocalCustomer {
  id?: string;
  remoteId?: string;
  name: string;
  phone: string;
  email?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  syncStatus: 'synced' | 'pending' | 'error';
  lastModified: Date;
}

export interface LocalJob {
  id?: string;
  remoteId?: string;
  customerId: string;
  assignedTo: string;
  status: string;
  type: string;
  punchoutItems: any[];
  walkthroughReport?: any;
  materialsNeeded: any[];
  scheduledDate?: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  lastModified: Date;
}

export interface LocalPhoto {
  id?: string;
  remoteId?: string;
  jobId: string;
  localBlob?: Blob;
  localUri?: string;
  remoteUrl?: string;
  caption?: string;
  photoType: string;
  syncStatus: 'pending' | 'uploading' | 'synced' | 'error';
  takenAt: Date;
}

export interface SyncQueueItem {
  id?: number;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: 'customers' | 'jobs' | 'photos';
  localId: string;
  payload: any;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  createdAt: Date;
}

class FieldSyncDB extends Dexie {
  customers!: Table<LocalCustomer>;
  jobs!: Table<LocalJob>;
  photos!: Table<LocalPhoto>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('FieldSyncDB');
    
    this.version(1).stores({
      customers: '++id, remoteId, name, phone, syncStatus',
      jobs: '++id, remoteId, customerId, assignedTo, status, syncStatus',
      photos: '++id, remoteId, jobId, syncStatus',
      syncQueue: '++id, type, table, localId, createdAt'
    });
  }
}

export const db = new FieldSyncDB();
```

## Sync Engine

### Core Sync Logic
```typescript
// src/lib/sync.ts
import { db, type SyncQueueItem } from './db';
import { supabase } from './supabase';

class SyncEngine {
  private isProcessing = false;
  private onlineHandler: () => void;

  constructor() {
    // Auto-sync when coming online
    this.onlineHandler = () => this.processQueue();
    window.addEventListener('online', this.onlineHandler);
  }

  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'createdAt'>) {
    await db.syncQueue.add({
      ...item,
      attempts: 0,
      createdAt: new Date()
    });
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || !navigator.onLine) return;
    
    this.isProcessing = true;
    
    try {
      const pending = await db.syncQueue
        .where('attempts')
        .below(5) // Max 5 retries
        .toArray();
      
      for (const item of pending) {
        try {
          await this.syncItem(item);
          await db.syncQueue.delete(item.id!);
        } catch (error) {
          // Increment attempts
          await db.syncQueue.update(item.id!, {
            attempts: item.attempts + 1,
            lastAttempt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async syncItem(item: SyncQueueItem) {
    switch (item.table) {
      case 'jobs':
        return this.syncJob(item);
      case 'photos':
        return this.syncPhoto(item);
      case 'customers':
        return this.syncCustomer(item);
    }
  }

  private async syncJob(item: SyncQueueItem) {
    const { type, localId, payload } = item;
    
    if (type === 'CREATE') {
      const { data, error } = await supabase
        .from('jobs')
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local record with remote ID
      await db.jobs.update(localId, {
        remoteId: data.id,
        syncStatus: 'synced'
      });
    } else if (type === 'UPDATE') {
      const localJob = await db.jobs.get(localId);
      if (!localJob?.remoteId) throw new Error('No remote ID for update');
      
      const { error } = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', localJob.remoteId);
      
      if (error) throw error;
      
      await db.jobs.update(localId, { syncStatus: 'synced' });
    }
  }

  private async syncPhoto(item: SyncQueueItem) {
    const photo = await db.photos.get(item.localId);
    if (!photo?.localBlob) throw new Error('No photo blob found');
    
    // Upload to Supabase Storage
    const fileName = `${photo.jobId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(fileName, photo.localBlob);
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('job-photos')
      .getPublicUrl(fileName);
    
    // Insert photo record
    const { data, error } = await supabase
      .from('photos')
      .insert({
        job_id: photo.jobId,
        url: publicUrl,
        caption: photo.caption,
        photo_type: photo.photoType
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update local record
    await db.photos.update(item.localId, {
      remoteId: data.id,
      remoteUrl: publicUrl,
      syncStatus: 'synced',
      localBlob: undefined // Clear blob to save space
    });
  }

  private async syncCustomer(item: SyncQueueItem) {
    // Similar pattern to syncJob
  }

  // Get pending count for UI
  async getPendingCount(): Promise<number> {
    return db.syncQueue.count();
  }

  destroy() {
    window.removeEventListener('online', this.onlineHandler);
  }
}

export const syncEngine = new SyncEngine();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).syncEngine = syncEngine;
}
```

## Offline-Aware Hooks

### useOnlineStatus
```typescript
// src/hooks/useOnlineStatus.ts
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### useJobs (Offline-First)
```typescript
// src/hooks/useJobs.ts
import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { syncEngine } from '../lib/sync';
import { useOnlineStatus } from './useOnlineStatus';

export function useJobs(userId: string) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useOnlineStatus();

  // Load from local DB first (instant)
  useEffect(() => {
    async function loadLocal() {
      const localJobs = await db.jobs
        .where('assignedTo')
        .equals(userId)
        .toArray();
      setJobs(localJobs);
      setLoading(false);
    }
    loadLocal();
  }, [userId]);

  // Then sync with remote if online
  useEffect(() => {
    if (!isOnline) return;

    async function syncRemote() {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, customer:customers(*)')
          .eq('assigned_to', userId);

        if (error) throw error;

        // Update local DB
        for (const job of data) {
          const existing = await db.jobs
            .where('remoteId')
            .equals(job.id)
            .first();

          if (existing) {
            await db.jobs.update(existing.id!, {
              ...job,
              syncStatus: 'synced',
              lastModified: new Date()
            });
          } else {
            await db.jobs.add({
              remoteId: job.id,
              ...job,
              syncStatus: 'synced',
              lastModified: new Date()
            });
          }
        }

        // Reload from local DB
        const updated = await db.jobs
          .where('assignedTo')
          .equals(userId)
          .toArray();
        setJobs(updated);
      } catch (e) {
        console.error('Remote sync failed:', e);
        // Don't set error - we still have local data
      }
    }

    syncRemote();
  }, [userId, isOnline]);

  // Create job (offline-capable)
  const createJob = async (jobData: any) => {
    const localJob = {
      ...jobData,
      syncStatus: 'pending' as const,
      lastModified: new Date()
    };

    const id = await db.jobs.add(localJob);
    
    await syncEngine.addToQueue({
      type: 'CREATE',
      table: 'jobs',
      localId: String(id),
      payload: jobData
    });

    // Update local state
    setJobs(prev => [...prev, { ...localJob, id }]);
    
    return id;
  };

  // Update job (offline-capable)
  const updateJob = async (id: string, updates: any) => {
    await db.jobs.update(id, {
      ...updates,
      syncStatus: 'pending',
      lastModified: new Date()
    });

    await syncEngine.addToQueue({
      type: 'UPDATE',
      table: 'jobs',
      localId: id,
      payload: updates
    });

    setJobs(prev => prev.map(j => 
      j.id === id ? { ...j, ...updates } : j
    ));
  };

  return { jobs, loading, error, createJob, updateJob };
}
```

## Photo Capture

### Camera Hook
```typescript
// src/hooks/useCamera.ts
import { useCallback, useRef } from 'react';
import { db } from '../lib/db';
import { syncEngine } from '../lib/sync';

export function useCamera(jobId: string) {
  const inputRef = useRef<HTMLInputElement>(null);

  const capturePhoto = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleCapture = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Compress if needed
    const blob = await compressImage(file, 1024, 0.8);
    
    // Create local URL for display
    const localUri = URL.createObjectURL(blob);

    // Save to IndexedDB
    const id = await db.photos.add({
      jobId,
      localBlob: blob,
      localUri,
      photoType: 'issue',
      syncStatus: 'pending',
      takenAt: new Date()
    });

    // Queue for sync
    await syncEngine.addToQueue({
      type: 'CREATE',
      table: 'photos',
      localId: String(id),
      payload: { jobId }
    });

    return { id: String(id), localUri };
  }, [jobId]);

  const CameraInput = () => (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handleCapture}
      className="hidden"
    />
  );

  return { capturePhoto, CameraInput };
}

// Helper: Compress image
async function compressImage(
  file: File, 
  maxSize: number, 
  quality: number
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => resolve(blob!),
        'image/jpeg',
        quality
      );
    };
    img.src = URL.createObjectURL(file);
  });
}
```

## Sync Status UI Component
```tsx
// src/components/SyncStatus.tsx
import { useState, useEffect } from 'react';
import { syncEngine } from '../lib/sync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function SyncStatus() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await syncEngine.getPendingCount();
      setPendingCount(count);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-sm">
        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        Offline Mode
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-sm">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        Syncing ({pendingCount})
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
      <span className="w-2 h-2 bg-green-500 rounded-full" />
      Synced
    </div>
  );
}
```

## Testing Offline Mode

### In Chrome DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from the throttling dropdown
4. Test app functionality
5. Re-enable network
6. Verify sync completes

### Simulating Spotty Connection
```typescript
// In browser console during development
function simulateSpottyConnection() {
  let online = true;
  setInterval(() => {
    online = !online;
    if (online) {
      console.log('📶 Back online');
      window.dispatchEvent(new Event('online'));
    } else {
      console.log('📴 Gone offline');
      window.dispatchEvent(new Event('offline'));
    }
  }, 10000); // Toggle every 10 seconds
}
```
