import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { db, type LocalMaterialsList } from '../lib/db';
import { syncEngine } from '../lib/sync';
import { useAuthStore } from '../stores/authStore';
import { generateTempId } from '../lib/utils';
import type { Material, MaterialCategory } from '../types';

export interface MaterialWithProperty extends Material {
  propertyId: string;
  propertyAddress?: string;
  materialsListId: string;
}

interface UseMaterialsResult {
  materials: MaterialWithProperty[];
  loading: boolean;
  error: string | null;
  addMaterial: (material: Omit<Material, 'id'>, propertyId: string) => Promise<void>;
  updateMaterial: (id: string, updates: Partial<Material>) => Promise<void>;
  togglePurchased: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

interface SupabaseMaterialsList {
  id: string;
  property_id: string;
  items: Material[];
  property?: { id: string; street: string; city: string };
}

export function useMaterials(): UseMaterialsResult {
  const { organization, user } = useAuthStore();
  const [materials, setMaterials] = useState<MaterialWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    if (!organization) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try IndexedDB first for instant display
      const cachedLists = await db.materials_lists.toArray();
      if (cachedLists.length > 0) {
        const allMaterials = flattenMaterialsLists(cachedLists);
        setMaterials(allMaterials);
      }

      // Fetch fresh from Supabase
      const { data, error: fetchError } = await supabase
        .from('materials_lists')
        .select(`
          *,
          property:properties(id, street, city)
        `);

      if (fetchError) throw fetchError;

      const typedData = (data || []) as SupabaseMaterialsList[];
      const allMaterials = flattenMaterialsLists(
        typedData.map((d) => ({
          id: d.id,
          propertyId: d.property_id,
          items: d.items || [],
          property: d.property,
          syncStatus: 'synced' as const,
          lastModified: new Date(),
        }))
      );
      setMaterials(allMaterials);

      // Cache in IndexedDB
      for (const list of typedData) {
        const localList: LocalMaterialsList = {
          id: list.id,
          propertyId: list.property_id,
          items: list.items || [],
          property: list.property,
          syncStatus: 'synced',
          lastModified: new Date(),
        };
        await db.materials_lists.put(localList);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const addMaterial = useCallback(
    async (material: Omit<Material, 'id'>, propertyId: string) => {
      if (!user) return;

      const newMaterial: Material = {
        ...material,
        id: generateTempId(),
      };

      // Optimistic update
      setMaterials((prev) => [
        ...prev,
        {
          ...newMaterial,
          propertyId,
          materialsListId: '',
        },
      ]);

      try {
        // Check if a materials list exists for this property
        let { data: existingList } = await supabase
          .from('materials_lists')
          .select('*')
          .eq('property_id', propertyId)
          .single();

        if (!existingList) {
          // Create new materials list
          const { data: newList, error: createError } = await supabase
            .from('materials_lists')
            .insert({
              property_id: propertyId,
              created_by_user_id: user.id,
              items: [newMaterial],
            })
            .select()
            .single();

          if (createError) throw createError;
          existingList = newList;
        } else {
          // Add to existing list
          const updatedItems = [...(existingList.items || []), newMaterial];
          const { error: updateError } = await supabase
            .from('materials_lists')
            .update({ items: updatedItems })
            .eq('id', existingList.id);

          if (updateError) throw updateError;
        }

        // Refetch to get consistent state
        await fetchMaterials();
      } catch (err) {
        console.error('Error adding material:', err);
        // Revert optimistic update
        setMaterials((prev) => prev.filter((m) => m.id !== newMaterial.id));
        throw err;
      }
    },
    [user, fetchMaterials]
  );

  const updateMaterial = useCallback(
    async (id: string, updates: Partial<Material>) => {
      // Optimistic update
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );

      try {
        // Find which list this material belongs to
        const material = materials.find((m) => m.id === id);
        if (!material) return;

        const { data: list } = await supabase
          .from('materials_lists')
          .select('*')
          .eq('property_id', material.propertyId)
          .single();

        if (list) {
          const updatedItems = (list.items || []).map((item: Material) =>
            item.id === id ? { ...item, ...updates } : item
          );

          await supabase
            .from('materials_lists')
            .update({ items: updatedItems })
            .eq('id', list.id);
        }
      } catch (err) {
        console.error('Error updating material:', err);
        // Refetch to restore state
        await fetchMaterials();
        throw err;
      }
    },
    [materials, fetchMaterials]
  );

  const togglePurchased = useCallback(
    async (id: string) => {
      const material = materials.find((m) => m.id === id);
      if (!material) return;

      const newStatus = material.status === 'purchased' ? 'needed' : 'purchased';
      const updates: Partial<Material> = {
        status: newStatus,
        purchasedAt: newStatus === 'purchased' ? new Date().toISOString() : undefined,
      };

      // Optimistic update
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );

      // Queue for sync if offline
      if (!navigator.onLine) {
        await syncEngine.queueOperation({
          type: 'update',
          table: 'materials',
          data: { id, ...updates },
        });
        return;
      }

      try {
        await updateMaterial(id, updates);
      } catch (err) {
        console.error('Error toggling purchased:', err);
        // Revert optimistic update
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, status: material.status, purchasedAt: material.purchasedAt }
              : m
          )
        );
      }
    },
    [materials, updateMaterial]
  );

  return {
    materials,
    loading,
    error,
    addMaterial,
    updateMaterial,
    togglePurchased,
    refetch: fetchMaterials,
  };
}

// Flatten materials lists into individual materials with property info
function flattenMaterialsLists(lists: LocalMaterialsList[]): MaterialWithProperty[] {
  const allMaterials: MaterialWithProperty[] = [];

  for (const list of lists) {
    const items = list.items || [];
    const propertyAddress = list.property
      ? `${list.property.street}, ${list.property.city}`
      : undefined;

    for (const item of items) {
      allMaterials.push({
        ...item,
        propertyId: list.propertyId,
        propertyAddress,
        materialsListId: list.id,
      });
    }
  }

  return allMaterials;
}

// Predefined material templates for common items
export const materialTemplates: Array<{
  name: string;
  category: MaterialCategory;
  unit: string;
}> = [
  { name: 'Electrical Outlet', category: 'electrical', unit: 'each' },
  { name: 'Light Switch', category: 'electrical', unit: 'each' },
  { name: 'Wire Nuts', category: 'electrical', unit: 'pack' },
  { name: 'Romex Wire 12/2', category: 'electrical', unit: 'ft' },
  { name: 'PVC Pipe 2"', category: 'plumbing', unit: 'ft' },
  { name: 'PVC Elbow 2"', category: 'plumbing', unit: 'each' },
  { name: 'Faucet', category: 'plumbing', unit: 'each' },
  { name: 'Water Supply Line', category: 'plumbing', unit: 'each' },
  { name: 'HVAC Filter', category: 'hvac', unit: 'each' },
  { name: '2x4 Lumber', category: 'lumber', unit: 'each' },
  { name: '2x6 Lumber', category: 'lumber', unit: 'each' },
  { name: 'Plywood 4x8', category: 'lumber', unit: 'sheet' },
  { name: 'Deck Screws', category: 'hardware', unit: 'box' },
  { name: 'Wood Screws', category: 'hardware', unit: 'box' },
  { name: 'Door Hinges', category: 'hardware', unit: 'set' },
  { name: 'Door Latch', category: 'hardware', unit: 'each' },
  { name: 'Trim Paint', category: 'paint', unit: 'gallon' },
  { name: 'Caulk', category: 'paint', unit: 'tube' },
  { name: 'Vinyl Flooring', category: 'flooring', unit: 'sqft' },
  { name: 'Carpet Padding', category: 'flooring', unit: 'sqft' },
];
