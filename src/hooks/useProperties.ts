import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { db, type LocalProperty, type LocalCustomer, type LocalPhase } from '../lib/db';
import { useAuthStore } from '../stores/authStore';
import type { Property, Customer, Phase } from '../types';

export interface PropertyWithRelations extends Property {
  customer: Customer;
  phases: Phase[];
}

interface UsePropertiesOptions {
  status?: string;
  assignedToMe?: boolean;
}

interface UsePropertiesResult {
  properties: PropertyWithRelations[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProperties(options: UsePropertiesOptions = {}): UsePropertiesResult {
  const { organization, user } = useAuthStore();
  const [properties, setProperties] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!organization) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, try to load from IndexedDB for instant display
      const cachedProperties = await db.properties.toArray();
      if (cachedProperties.length > 0) {
        // Transform cached data
        const transformed = await transformCachedProperties(cachedProperties);
        setProperties(transformed);
      }

      // Then fetch fresh data from Supabase
      let query = supabase
        .from('properties')
        .select(`
          *,
          customer:customers(*),
          phases(*)
        `)
        .order('created_at', { ascending: false });

      if (options.status) {
        query = query.eq('overall_status', options.status);
      }

      if (options.assignedToMe && user) {
        query = query.or(`created_by_user_id.eq.${user.id},phases.assigned_user_id.eq.${user.id}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const transformed = transformSupabaseProperties(data || []);
      setProperties(transformed);

      // Cache in IndexedDB
      await cacheProperties(transformed);
    } catch (err) {
      console.error('Error fetching properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, [organization, user, options.status, options.assignedToMe]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return {
    properties,
    loading,
    error,
    refetch: fetchProperties,
  };
}

// Transform Supabase response to our types
function transformSupabaseProperties(data: Record<string, unknown>[]): PropertyWithRelations[] {
  return data.map((p) => ({
    id: p.id as string,
    street: p.street as string,
    unit: p.unit as string | undefined,
    city: p.city as string,
    state: p.state as string,
    zip: p.zip as string,
    county: p.county as string | undefined,
    lat: p.lat as number | undefined,
    lng: p.lng as number | undefined,
    customerId: p.customer_id as string,
    customer: p.customer
      ? {
          id: (p.customer as Record<string, unknown>).id as string,
          organizationId: (p.customer as Record<string, unknown>).organization_id as string,
          firstName: (p.customer as Record<string, unknown>).first_name as string,
          lastName: (p.customer as Record<string, unknown>).last_name as string,
          phone: (p.customer as Record<string, unknown>).phone as string,
          email: (p.customer as Record<string, unknown>).email as string | undefined,
          preferredContact: (p.customer as Record<string, unknown>).preferred_contact as 'phone' | 'text' | 'email',
          notes: (p.customer as Record<string, unknown>).notes as string | undefined,
          createdAt: (p.customer as Record<string, unknown>).created_at as string,
          updatedAt: (p.customer as Record<string, unknown>).updated_at as string,
        }
      : null!,
    manufacturer: p.manufacturer as string,
    model: p.model as string | undefined,
    serialNumber: p.serial_number as string | undefined,
    overallStatus: p.overall_status as Property['overallStatus'],
    currentPhase: p.current_phase as string | undefined,
    dealershipId: p.dealership_id as string,
    createdByOrgId: p.created_by_org_id as string,
    portalCode: p.portal_code as string | undefined,
    createdAt: p.created_at as string,
    updatedAt: p.updated_at as string,
    phases: ((p.phases as Record<string, unknown>[]) || [])
      .map((ph) => ({
        id: ph.id as string,
        propertyId: ph.property_id as string,
        type: ph.type as Phase['type'],
        category: ph.category as Phase['category'],
        sortOrder: ph.sort_order as number,
        status: ph.status as Phase['status'],
        assignedOrgId: ph.assigned_org_id as string | undefined,
        assignedUserId: ph.assigned_user_id as string | undefined,
        scheduledDate: ph.scheduled_date as string | undefined,
        startedAt: ph.started_at as string | undefined,
        completedAt: ph.completed_at as string | undefined,
        notes: ph.notes as string | undefined,
        checklistItems: (ph.checklist_items as Phase['checklistItems']) || [],
        createdAt: ph.created_at as string,
        updatedAt: ph.updated_at as string,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

// Transform cached IndexedDB data
async function transformCachedProperties(cached: LocalProperty[]): Promise<PropertyWithRelations[]> {
  const properties: PropertyWithRelations[] = [];

  for (const p of cached) {
    // Fetch related customer from cache
    const customers = await db.customers.where('id').equals(p.customerId).toArray();
    const customer = customers[0];
    // Fetch related phases from cache
    const phases = await db.phases.where('propertyId').equals(p.id).toArray();

    if (customer) {
      properties.push({
        ...p,
        customer: localCustomerToCustomer(customer),
        phases: phases.map(localPhaseToPhase).sort((a, b) => a.sortOrder - b.sortOrder),
      } as PropertyWithRelations);
    }
  }

  return properties;
}

function localCustomerToCustomer(lc: LocalCustomer): Customer {
  return {
    id: lc.id,
    organizationId: lc.organizationId,
    firstName: lc.firstName,
    lastName: lc.lastName,
    phone: lc.phone,
    email: lc.email,
    preferredContact: lc.preferredContact,
    notes: lc.notes,
    createdAt: lc.createdAt,
    updatedAt: lc.updatedAt,
  };
}

function localPhaseToPhase(lp: LocalPhase): Phase {
  return {
    id: lp.id,
    propertyId: lp.propertyId,
    type: lp.type,
    category: lp.category,
    sortOrder: lp.sortOrder,
    status: lp.status,
    assignedOrgId: lp.assignedOrgId,
    assignedUserId: lp.assignedUserId,
    scheduledDate: lp.scheduledDate,
    startedAt: lp.startedAt,
    completedAt: lp.completedAt,
    notes: lp.notes,
    checklistItems: lp.checklistItems,
    createdAt: lp.createdAt,
    updatedAt: lp.updatedAt,
  };
}

// Cache properties in IndexedDB
async function cacheProperties(properties: PropertyWithRelations[]): Promise<void> {
  for (const property of properties) {
    // Cache the property (without nested relations)
    const { customer, phases, ...propertyData } = property;
    const localProperty: LocalProperty = {
      ...propertyData,
      syncStatus: 'synced',
      lastModified: new Date(),
    };
    await db.properties.put(localProperty);

    // Cache customer
    if (customer) {
      const localCustomer: LocalCustomer = {
        ...customer,
        syncStatus: 'synced',
        lastModified: new Date(),
      };
      await db.customers.put(localCustomer);
    }

    // Cache phases
    for (const phase of phases) {
      const localPhase: LocalPhase = {
        ...phase,
        syncStatus: 'synced',
        lastModified: new Date(),
      };
      await db.phases.put(localPhase);
    }
  }
}

// Hook for single property
export function useProperty(id: string | undefined) {
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const propertyId = id; // Capture for closure

    async function fetchProperty() {
      setLoading(true);
      setError(null);

      try {
        // Try IndexedDB first
        const cachedList = await db.properties.where('id').equals(propertyId).toArray();
        const cached = cachedList[0];
        if (cached) {
          const transformed = await transformCachedProperties([cached]);
          if (transformed.length > 0) {
            setProperty(transformed[0]);
          }
        }

        // Fetch fresh from Supabase
        const { data, error: fetchError } = await supabase
          .from('properties')
          .select(`
            *,
            customer:customers(*),
            phases(*)
          `)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        const transformed = transformSupabaseProperties([data])[0];
        setProperty(transformed);

        // Cache
        await cacheProperties([transformed]);
      } catch (err) {
        console.error('Error fetching property:', err);
        setError(err instanceof Error ? err.message : 'Failed to load property');
      } finally {
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id]);

  return { property, loading, error };
}
