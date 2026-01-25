/**
 * QuickBooks Online Integration
 * 
 * This module handles OAuth2 authentication and API calls to QuickBooks.
 * Requires a QuickBooks Online account and app credentials from developer.intuit.com
 * 
 * Required env vars:
 * - VITE_QUICKBOOKS_CLIENT_ID
 * - VITE_QUICKBOOKS_REDIRECT_URI
 * 
 * Server-side (Supabase Edge Function):
 * - QUICKBOOKS_CLIENT_SECRET
 * - QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN
 */

import { supabase } from './supabase';

// QuickBooks API endpoints
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QB_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

// Scopes needed for invoice management
const QB_SCOPES = [
  'com.intuit.quickbooks.accounting',
  'openid',
  'profile',
  'email',
];

export interface QBTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string; // QuickBooks company ID
  expiresAt: number;
}

export interface QBCustomer {
  Id?: string;
  DisplayName: string;
  PrimaryPhone?: { FreeFormNumber: string };
  PrimaryEmailAddr?: { Address: string };
  BillAddr?: {
    Line1: string;
    City: string;
    CountrySubDivisionCode: string;
    PostalCode: string;
  };
}

export interface QBInvoiceLine {
  Description: string;
  Amount: number;
  DetailType: 'SalesItemLineDetail';
  SalesItemLineDetail: {
    ItemRef?: { value: string; name: string };
    Qty?: number;
    UnitPrice?: number;
  };
}

export interface QBInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef: { value: string };
  Line: QBInvoiceLine[];
  DueDate?: string;
  TxnDate?: string;
  PrivateNote?: string;
  CustomerMemo?: { value: string };
}

export interface QBSyncResult {
  success: boolean;
  qbId?: string;
  error?: string;
}

// Check if QuickBooks is configured
export function isQuickBooksConfigured(): boolean {
  return !!(
    import.meta.env.VITE_QUICKBOOKS_CLIENT_ID &&
    import.meta.env.VITE_QUICKBOOKS_REDIRECT_URI
  );
}

// Generate OAuth2 authorization URL
export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_QUICKBOOKS_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_QUICKBOOKS_REDIRECT_URI,
    response_type: 'code',
    scope: QB_SCOPES.join(' '),
    state: state || crypto.randomUUID(),
  });

  return `${QB_AUTH_URL}?${params.toString()}`;
}

// Exchange auth code for tokens (must be done server-side)
export async function exchangeCodeForTokens(code: string): Promise<QBTokens | null> {
  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-auth', {
      body: { action: 'exchange', code },
    });

    if (error) throw error;
    return data as QBTokens;
  } catch (err) {
    console.error('Failed to exchange QB code:', err);
    return null;
  }
}

// Get stored tokens for the organization
export async function getStoredTokens(orgId: string): Promise<QBTokens | null> {
  try {
    const { data, error } = await supabase
      .from('organization_integrations')
      .select('quickbooks_tokens')
      .eq('organization_id', orgId)
      .single();

    if (error || !data?.quickbooks_tokens) return null;
    return data.quickbooks_tokens as QBTokens;
  } catch {
    return null;
  }
}

// Store tokens for the organization
export async function storeTokens(orgId: string, tokens: QBTokens): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('organization_integrations')
      .upsert({
        organization_id: orgId,
        quickbooks_tokens: tokens,
        quickbooks_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    return !error;
  } catch {
    return false;
  }
}

// Refresh tokens if expired (called server-side)
export async function refreshTokensIfNeeded(orgId: string): Promise<QBTokens | null> {
  const tokens = await getStoredTokens(orgId);
  if (!tokens) return null;

  // Check if token expires in next 5 minutes
  if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokens; // Still valid
  }

  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-auth', {
      body: { action: 'refresh', refreshToken: tokens.refreshToken },
    });

    if (error) throw error;

    const newTokens = data as QBTokens;
    await storeTokens(orgId, newTokens);
    return newTokens;
  } catch (err) {
    console.error('Failed to refresh QB tokens:', err);
    return null;
  }
}

// Disconnect QuickBooks
export async function disconnectQuickBooks(orgId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('organization_integrations')
      .update({
        quickbooks_tokens: null,
        quickbooks_connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', orgId);

    return !error;
  } catch {
    return false;
  }
}

// ============ QuickBooks API Operations ============
// These call Supabase Edge Functions which handle the actual API calls

// Find or create a customer in QuickBooks
export async function syncCustomerToQB(
  orgId: string,
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  }
): Promise<QBSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
      body: {
        action: 'syncCustomer',
        orgId,
        customer,
      },
    });

    if (error) throw error;
    return data as QBSyncResult;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Create an invoice in QuickBooks
export async function createInvoice(
  orgId: string,
  invoice: {
    customerId: string; // Our customer ID (we'll look up QB ID)
    propertyId: string;
    lines: Array<{
      description: string;
      amount: number;
      quantity?: number;
      unitPrice?: number;
    }>;
    dueDate?: string;
    memo?: string;
    privateNote?: string;
  }
): Promise<QBSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
      body: {
        action: 'createInvoice',
        orgId,
        invoice,
      },
    });

    if (error) throw error;
    return data as QBSyncResult;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Create invoice from time entries
export async function createInvoiceFromTimeEntries(
  orgId: string,
  propertyId: string,
  timeEntryIds: string[],
  options?: {
    includeLineItems?: boolean; // Break out each entry vs single line
    addMileage?: boolean;
  }
): Promise<QBSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
      body: {
        action: 'createInvoiceFromTime',
        orgId,
        propertyId,
        timeEntryIds,
        options,
      },
    });

    if (error) throw error;
    return data as QBSyncResult;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Get invoice status
export async function getInvoiceStatus(
  orgId: string,
  qbInvoiceId: string
): Promise<{ status: 'draft' | 'sent' | 'paid' | 'overdue' | 'unknown'; balance?: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
      body: {
        action: 'getInvoiceStatus',
        orgId,
        qbInvoiceId,
      },
    });

    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

// Send invoice via QuickBooks email
export async function sendInvoice(
  orgId: string,
  qbInvoiceId: string,
  email?: string
): Promise<QBSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
      body: {
        action: 'sendInvoice',
        orgId,
        qbInvoiceId,
        email,
      },
    });

    if (error) throw error;
    return data as QBSyncResult;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
