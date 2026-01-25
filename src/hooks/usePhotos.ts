import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { db, type LocalPhoto } from '../lib/db';
import { syncEngine } from '../lib/sync';
import { useAuthStore } from '../stores/authStore';
import { generateTempId } from '../lib/utils';
import type { Photo, PhotoType } from '../types';

interface UsePhotosOptions {
  propertyId?: string;
  phaseId?: string;
  issueId?: string;
}

interface UsePhotosResult {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  capturePhoto: (file: File, options?: CaptureOptions) => Promise<Photo>;
  uploadPhoto: (photo: Photo) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

interface CaptureOptions {
  photoType?: PhotoType;
  caption?: string;
}

// Image compression settings
const MAX_IMAGE_SIZE = 1920;
const IMAGE_QUALITY = 0.8;
const THUMBNAIL_SIZE = 200;

export function usePhotos(options: UsePhotosOptions = {}): UsePhotosResult {
  const { user } = useAuthStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    const { propertyId, phaseId, issueId } = options;
    if (!propertyId && !phaseId && !issueId) return;

    setLoading(true);
    setError(null);

    try {
      // Try IndexedDB first
      let cachedPhotos: LocalPhoto[] = [];
      if (propertyId) {
        cachedPhotos = await db.photos.where('propertyId').equals(propertyId).toArray();
      }
      if (cachedPhotos.length > 0) {
        setPhotos(cachedPhotos.map(localPhotoToPhoto));
      }

      // Fetch from Supabase
      let query = supabase.from('photos').select('*');

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }
      if (phaseId) {
        query = query.eq('phase_id', phaseId);
      }
      if (issueId) {
        query = query.eq('issue_id', issueId);
      }

      const { data, error: fetchError } = await query.order('taken_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformed: Photo[] = (data || []).map((p) => ({
        id: p.id,
        propertyId: p.property_id,
        phaseId: p.phase_id,
        issueId: p.issue_id,
        url: p.url,
        thumbnailUrl: p.thumbnail_url,
        caption: p.caption,
        photoType: p.photo_type,
        takenAt: p.taken_at,
        takenByUserId: p.taken_by_user_id,
        lat: p.lat,
        lng: p.lng,
        syncStatus: 'synced' as const,
        createdAt: p.created_at,
      }));

      setPhotos(transformed);

      // Cache in IndexedDB
      for (const photo of transformed) {
        const localPhoto: LocalPhoto = {
          propertyId: photo.propertyId,
          phaseId: photo.phaseId,
          issueId: photo.issueId,
          remoteId: photo.id,
          remoteUrl: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
          caption: photo.caption,
          photoType: photo.photoType,
          takenAt: new Date(photo.takenAt),
          takenByUserId: photo.takenByUserId,
          syncStatus: 'synced',
          lastModified: new Date(),
        };
        await db.photos.put(localPhoto);
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [options]);

  const capturePhoto = useCallback(
    async (file: File, captureOptions: CaptureOptions = {}): Promise<Photo> => {
      const { photoType = 'general', caption } = captureOptions;
      const { propertyId, phaseId, issueId } = options;

      if (!propertyId) {
        throw new Error('Property ID is required to capture photos');
      }

      // Compress the image
      const compressedBlob = await compressImage(file, MAX_IMAGE_SIZE, IMAGE_QUALITY);
      const localUri = URL.createObjectURL(compressedBlob);

      // Generate thumbnail
      const thumbnailBlob = await compressImage(file, THUMBNAIL_SIZE, 0.7);
      const thumbnailUri = URL.createObjectURL(thumbnailBlob);

      // Get location if available
      let lat: number | undefined;
      let lng: number | undefined;

      try {
        const position = await getCurrentPosition();
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch {
        // Location not available, continue without it
      }

      const photoId = generateTempId();
      const now = new Date();

      const photo: Photo = {
        id: photoId,
        propertyId,
        phaseId,
        issueId,
        localUri,
        url: localUri, // Use localUri as URL until uploaded
        thumbnailUrl: thumbnailUri,
        caption,
        photoType,
        takenAt: now.toISOString(),
        takenByUserId: user?.id,
        lat,
        lng,
        syncStatus: 'pending',
        createdAt: now.toISOString(),
      };

      // Store locally
      const localPhoto: LocalPhoto & { localBlob?: Blob; thumbnailBlob?: Blob } = {
        localId: undefined,
        remoteId: undefined,
        propertyId,
        phaseId,
        issueId,
        localBlob: compressedBlob,
        localUri,
        thumbnailUrl: thumbnailUri,
        caption,
        photoType,
        takenAt: now,
        takenByUserId: user?.id,
        syncStatus: 'pending',
        lastModified: now,
      };

      await db.photos.add(localPhoto);

      // Add to state
      setPhotos((prev) => [photo, ...prev]);

      // Queue for upload if online, otherwise queue for later
      if (navigator.onLine) {
        // Start upload immediately
        uploadPhoto(photo).catch(console.error);
      } else {
        await syncEngine.queueOperation({
          type: 'insert',
          table: 'photos',
          data: { id: photoId, propertyId, phaseId, issueId },
        });
      }

      return photo;
    },
    [options, user]
  );

  const uploadPhoto = useCallback(async (photo: Photo): Promise<void> => {
    try {
      // Get the blob from IndexedDB
      const storedPhotos = await db.photos.where('localUri').equals(photo.localUri || '').toArray();
      const stored = storedPhotos[0] as LocalPhoto & { localBlob?: Blob; thumbnailBlob?: Blob } | undefined;

      if (!stored || !stored.localBlob) {
        throw new Error('Photo blob not found');
      }

      const blob = stored.localBlob;
      const thumbnailBlob = stored.thumbnailBlob;

      // Upload main image to Supabase Storage
      const filename = `${photo.propertyId}/${photo.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename);

      // Upload thumbnail
      let thumbnailUrl: string | undefined;
      if (thumbnailBlob) {
        const thumbFilename = `${photo.propertyId}/${photo.id}_thumb.jpg`;
        await supabase.storage.from('photos').upload(thumbFilename, thumbnailBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        const { data: thumbUrlData } = supabase.storage.from('photos').getPublicUrl(thumbFilename);
        thumbnailUrl = thumbUrlData.publicUrl;
      }

      // Insert record into database
      const { error: insertError } = await supabase.from('photos').insert({
        id: photo.id,
        property_id: photo.propertyId,
        phase_id: photo.phaseId,
        issue_id: photo.issueId,
        url: urlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        caption: photo.caption,
        photo_type: photo.photoType,
        taken_at: photo.takenAt,
        taken_by_user_id: photo.takenByUserId,
        lat: photo.lat,
        lng: photo.lng,
      });

      if (insertError) throw insertError;

      // Update local state
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, url: urlData.publicUrl, thumbnailUrl, syncStatus: 'synced' as const }
            : p
        )
      );

      // Update IndexedDB
      if (stored.localId) {
        await db.photos.update(stored.localId, {
          remoteUrl: urlData.publicUrl,
          thumbnailUrl,
          syncStatus: 'synced',
          localBlob: undefined, // Clear blob to save space
        });
      }
    } catch (err) {
      console.error('Error uploading photo:', err);

      // Mark as error
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, syncStatus: 'error' as const } : p))
      );

      throw err;
    }
  }, []);

  const deletePhoto = useCallback(async (id: string): Promise<void> => {
    // Optimistic update
    setPhotos((prev) => prev.filter((p) => p.id !== id));

    try {
      // Delete from Supabase
      const { error: deleteError } = await supabase.from('photos').delete().eq('id', id);

      if (deleteError) throw deleteError;

      // Delete from IndexedDB
      const localPhotos = await db.photos.where('remoteId').equals(id).toArray();
      for (const lp of localPhotos) {
        if (lp.localId) {
          await db.photos.delete(lp.localId);
        }
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      // Refetch to restore state
      await fetchPhotos();
      throw err;
    }
  }, [fetchPhotos]);

  return {
    photos,
    loading,
    error,
    capturePhoto,
    uploadPhoto,
    deletePhoto,
    refetch: fetchPhotos,
  };
}

function localPhotoToPhoto(lp: LocalPhoto): Photo {
  return {
    id: lp.remoteId || `local-${lp.localId}`,
    propertyId: lp.propertyId,
    phaseId: lp.phaseId,
    issueId: lp.issueId,
    localUri: lp.localUri,
    url: lp.remoteUrl || lp.localUri || '',
    thumbnailUrl: lp.thumbnailUrl,
    caption: lp.caption,
    photoType: lp.photoType as PhotoType,
    takenAt: lp.takenAt.toISOString(),
    takenByUserId: lp.takenByUserId,
    syncStatus: lp.syncStatus,
    createdAt: lp.lastModified.toISOString(),
  };
}

// Compress image to specified max dimension and quality
async function compressImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if needed
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

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create blob'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Get current position with timeout
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60000,
    });
  });
}
