import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useOffline } from './useOffline';

export interface TimeEntry {
  id: string;
  propertyId: string;
  phaseId?: string;
  userId: string;
  startTime: string; // ISO string
  endTime?: string;
  pausedDuration: number;
  totalDuration?: number; // calculated on save
  hourlyRate: number;
  mileage?: number;
  mileageRate: number;
  earnings?: number;
  lat?: number;
  lng?: number;
  notes?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface UseTimeTrackingOptions {
  propertyId?: string;
  userId?: string;
}

interface UseTimeTrackingReturn {
  entries: TimeEntry[];
  loading: boolean;
  error: string | null;
  saveEntry: (entry: Omit<TimeEntry, 'id' | 'userId' | 'syncStatus' | 'createdAt' | 'updatedAt'>) => Promise<TimeEntry | null>;
  deleteEntry: (id: string) => Promise<boolean>;
  getPropertyEntries: (propertyId: string) => TimeEntry[];
  getTotalEarnings: (propertyId?: string) => { time: number; mileage: number; total: number };
  getTotalHours: (propertyId?: string) => number;
  refetch: () => Promise<void>;
}

export function useTimeTracking(options: UseTimeTrackingOptions = {}): UseTimeTrackingReturn {
  const { propertyId, userId } = options;
  const { isOnline } = useOffline();
  
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to fetch from Supabase if online
      if (isOnline) {
        let query = supabase
          .from('time_entries')
          .select('*')
          .order('start_time', { ascending: false });

        if (propertyId) {
          query = query.eq('property_id', propertyId);
        }
        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        const transformed = (data || []).map(transformFromDb);
        setEntries(transformed);

        // Cache locally
        for (const entry of transformed) {
          await db.timeEntries.put(entry);
        }
      } else {
        // Fetch from IndexedDB when offline
        let localEntries = await db.timeEntries
          .orderBy('startTime')
          .reverse()
          .toArray();

        if (propertyId) {
          localEntries = localEntries.filter(e => e.propertyId === propertyId);
        }
        if (userId) {
          localEntries = localEntries.filter(e => e.userId === userId);
        }

        setEntries(localEntries);
      }
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError('Failed to load time entries');

      // Fall back to local cache
      const localEntries = await db.timeEntries.toArray();
      setEntries(localEntries);
    } finally {
      setLoading(false);
    }
  }, [isOnline, propertyId, userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveEntry = useCallback(async (
    entryData: Omit<TimeEntry, 'id' | 'userId' | 'syncStatus' | 'createdAt' | 'updatedAt'>
  ): Promise<TimeEntry | null> => {
    const now = new Date().toISOString();
    
    const newEntry: TimeEntry = {
      ...entryData,
      id: crypto.randomUUID(),
      userId: userId || 'unknown',
      syncStatus: isOnline ? 'synced' : 'pending',
      createdAt: now,
      updatedAt: now,
    };

    // Calculate total duration and earnings
    if (entryData.endTime) {
      const start = new Date(entryData.startTime).getTime();
      const end = new Date(entryData.endTime).getTime();
      newEntry.totalDuration = end - start - entryData.pausedDuration;
      
      const hours = newEntry.totalDuration / 1000 / 60 / 60;
      const timeEarnings = hours * entryData.hourlyRate;
      const mileageEarnings = (entryData.mileage || 0) * entryData.mileageRate;
      newEntry.earnings = timeEarnings + mileageEarnings;
    }

    try {
      // Save locally first (optimistic)
      await db.timeEntries.put(newEntry);
      setEntries(prev => [newEntry, ...prev]);

      // Sync to Supabase if online
      if (isOnline) {
        const { error: insertError } = await supabase
          .from('time_entries')
          .insert(transformToDb(newEntry));

        if (insertError) {
          // Mark as pending for later sync
          const pendingEntry = { ...newEntry, syncStatus: 'pending' as const };
          await db.timeEntries.put(pendingEntry);
          setEntries(prev => prev.map(e => e.id === newEntry.id ? pendingEntry : e));
        }
      }

      return newEntry;
    } catch (err) {
      console.error('Error saving time entry:', err);
      setError('Failed to save time entry');
      return null;
    }
  }, [isOnline, userId]);

  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Remove locally first
      await db.timeEntries.delete(id);
      setEntries(prev => prev.filter(e => e.id !== id));

      // Sync deletion if online
      if (isOnline) {
        await supabase.from('time_entries').delete().eq('id', id);
      }

      return true;
    } catch (err) {
      console.error('Error deleting time entry:', err);
      return false;
    }
  }, [isOnline]);

  const getPropertyEntries = useCallback((propId: string): TimeEntry[] => {
    return entries.filter(e => e.propertyId === propId);
  }, [entries]);

  const getTotalEarnings = useCallback((propId?: string): { time: number; mileage: number; total: number } => {
    const filtered = propId ? entries.filter(e => e.propertyId === propId) : entries;
    
    return filtered.reduce((acc, entry) => {
      if (entry.totalDuration) {
        const hours = entry.totalDuration / 1000 / 60 / 60;
        acc.time += hours * entry.hourlyRate;
      }
      acc.mileage += (entry.mileage || 0) * entry.mileageRate;
      acc.total = acc.time + acc.mileage;
      return acc;
    }, { time: 0, mileage: 0, total: 0 });
  }, [entries]);

  const getTotalHours = useCallback((propId?: string): number => {
    const filtered = propId ? entries.filter(e => e.propertyId === propId) : entries;
    
    const totalMs = filtered.reduce((acc, entry) => acc + (entry.totalDuration || 0), 0);
    return totalMs / 1000 / 60 / 60;
  }, [entries]);

  return {
    entries,
    loading,
    error,
    saveEntry,
    deleteEntry,
    getPropertyEntries,
    getTotalEarnings,
    getTotalHours,
    refetch: fetchEntries,
  };
}

// Transform from database snake_case to camelCase
function transformFromDb(row: any): TimeEntry {
  return {
    id: row.id,
    propertyId: row.property_id,
    phaseId: row.phase_id,
    userId: row.user_id,
    startTime: row.start_time,
    endTime: row.end_time,
    pausedDuration: row.paused_duration || 0,
    totalDuration: row.total_duration,
    hourlyRate: row.hourly_rate || 40,
    mileage: row.mileage,
    mileageRate: row.mileage_rate || 0.67,
    earnings: row.earnings,
    lat: row.lat,
    lng: row.lng,
    notes: row.notes,
    syncStatus: row.sync_status || 'synced',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Transform to database snake_case
function transformToDb(entry: TimeEntry): Record<string, any> {
  return {
    id: entry.id,
    property_id: entry.propertyId,
    phase_id: entry.phaseId,
    user_id: entry.userId,
    start_time: entry.startTime,
    end_time: entry.endTime,
    paused_duration: entry.pausedDuration,
    total_duration: entry.totalDuration,
    hourly_rate: entry.hourlyRate,
    mileage: entry.mileage,
    mileage_rate: entry.mileageRate,
    earnings: entry.earnings,
    lat: entry.lat,
    lng: entry.lng,
    notes: entry.notes,
    sync_status: entry.syncStatus,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}
