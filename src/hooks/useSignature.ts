import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateTempId } from '../lib/utils';

export interface SignatureRecord {
  id: string;
  propertyId?: string;
  phaseId?: string;
  workOrderId?: string;
  signedByName: string;
  signedByRole: 'customer' | 'technician' | 'inspector' | 'other';
  signatureUrl: string;
  signedAt: string;
  syncStatus: 'pending' | 'synced' | 'error';
}

interface UseSignatureOptions {
  propertyId?: string;
  phaseId?: string;
  workOrderId?: string;
  bucket?: string;
}

interface UseSignatureResult {
  signatures: SignatureRecord[];
  loading: boolean;
  error: string | null;
  uploadSignature: (
    signatureData: string,
    signedByName: string,
    signedByRole: SignatureRecord['signedByRole']
  ) => Promise<SignatureRecord>;
  deleteSignature: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const SIGNATURES_BUCKET = 'signatures';

/**
 * Hook for handling signature capture and upload to Supabase storage
 */
export function useSignature(options: UseSignatureOptions = {}): UseSignatureResult {
  const { propertyId, phaseId, workOrderId, bucket = SIGNATURES_BUCKET } = options;

  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch existing signatures
   */
  const fetchSignatures = useCallback(async () => {
    if (!propertyId && !phaseId && !workOrderId) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('signatures').select('*');

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }
      if (phaseId) {
        query = query.eq('phase_id', phaseId);
      }
      if (workOrderId) {
        query = query.eq('work_order_id', workOrderId);
      }

      const { data, error: fetchError } = await query.order('signed_at', {
        ascending: false,
      });

      if (fetchError) throw fetchError;

      const transformed: SignatureRecord[] = (data || []).map((s) => ({
        id: s.id,
        propertyId: s.property_id,
        phaseId: s.phase_id,
        workOrderId: s.work_order_id,
        signedByName: s.signed_by_name,
        signedByRole: s.signed_by_role,
        signatureUrl: s.signature_url,
        signedAt: s.signed_at,
        syncStatus: 'synced' as const,
      }));

      setSignatures(transformed);
    } catch (err) {
      console.error('Error fetching signatures:', err);
      setError(err instanceof Error ? err.message : 'Failed to load signatures');
    } finally {
      setLoading(false);
    }
  }, [propertyId, phaseId, workOrderId]);

  /**
   * Convert base64 data URL to Blob
   */
  const base64ToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(parts[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
  };

  /**
   * Upload a signature to Supabase storage and create a record
   */
  const uploadSignature = useCallback(
    async (
      signatureData: string,
      signedByName: string,
      signedByRole: SignatureRecord['signedByRole']
    ): Promise<SignatureRecord> => {
      setError(null);

      const signatureId = generateTempId();
      const now = new Date().toISOString();

      // Create optimistic record
      const optimisticRecord: SignatureRecord = {
        id: signatureId,
        propertyId,
        phaseId,
        workOrderId,
        signedByName,
        signedByRole,
        signatureUrl: signatureData, // Use data URL temporarily
        signedAt: now,
        syncStatus: 'pending',
      };

      // Add to state optimistically
      setSignatures((prev) => [optimisticRecord, ...prev]);

      try {
        // Convert base64 to blob
        const blob = base64ToBlob(signatureData);

        // Generate storage path
        const folder = propertyId || workOrderId || 'general';
        const filename = `${folder}/${signatureId}.png`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filename, blob, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filename);

        const signatureUrl = urlData.publicUrl;

        // Insert record into database
        const { error: insertError } = await supabase.from('signatures').insert({
          id: signatureId,
          property_id: propertyId,
          phase_id: phaseId,
          work_order_id: workOrderId,
          signed_by_name: signedByName,
          signed_by_role: signedByRole,
          signature_url: signatureUrl,
          signed_at: now,
        });

        if (insertError) throw insertError;

        // Update state with synced record
        const syncedRecord: SignatureRecord = {
          ...optimisticRecord,
          signatureUrl,
          syncStatus: 'synced',
        };

        setSignatures((prev) =>
          prev.map((s) => (s.id === signatureId ? syncedRecord : s))
        );

        return syncedRecord;
      } catch (err) {
        console.error('Error uploading signature:', err);
        setError(err instanceof Error ? err.message : 'Failed to upload signature');

        // Mark as error in state
        setSignatures((prev) =>
          prev.map((s) =>
            s.id === signatureId ? { ...s, syncStatus: 'error' as const } : s
          )
        );

        throw err;
      }
    },
    [propertyId, phaseId, workOrderId, bucket]
  );

  /**
   * Delete a signature
   */
  const deleteSignature = useCallback(
    async (id: string): Promise<void> => {
      // Find the signature to get its URL
      const signature = signatures.find((s) => s.id === id);

      // Optimistic removal
      setSignatures((prev) => prev.filter((s) => s.id !== id));

      try {
        // Delete from storage if we have a URL
        if (signature?.signatureUrl && !signature.signatureUrl.startsWith('data:')) {
          // Extract filename from URL
          const urlParts = signature.signatureUrl.split('/');
          const filename = urlParts.slice(-2).join('/'); // folder/id.png

          await supabase.storage.from(bucket).remove([filename]);
        }

        // Delete from database
        const { error: deleteError } = await supabase
          .from('signatures')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;
      } catch (err) {
        console.error('Error deleting signature:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete signature');
        // Restore on error
        await fetchSignatures();
        throw err;
      }
    },
    [signatures, bucket, fetchSignatures]
  );

  return {
    signatures,
    loading,
    error,
    uploadSignature,
    deleteSignature,
    refetch: fetchSignatures,
  };
}

/**
 * Utility to validate if a string is valid signature data
 */
export function isValidSignatureData(data: string): boolean {
  return data.startsWith('data:image/png;base64,') && data.length > 100;
}

/**
 * Get signature dimensions from base64 data
 */
export async function getSignatureDimensions(
  signatureData: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load signature image'));
    img.src = signatureData;
  });
}
