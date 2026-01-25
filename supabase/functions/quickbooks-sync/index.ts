/**
 * QuickBooks Sync Edge Function
 * 
 * Handles customer and invoice sync with QuickBooks.
 * Requires valid tokens stored in organization_integrations table.
 * 
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QB_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use sandbox in development
const getApiBase = () => {
  const useSandbox = Deno.env.get('QUICKBOOKS_USE_SANDBOX') === 'true';
  return useSandbox ? QB_SANDBOX_API_BASE : QB_API_BASE;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { action, orgId, ...params } = await req.json();

    // Get tokens for this org
    const { data: integration, error: tokenError } = await supabase
      .from('organization_integrations')
      .select('quickbooks_tokens')
      .eq('organization_id', orgId)
      .single();

    if (tokenError || !integration?.quickbooks_tokens) {
      return new Response(
        JSON.stringify({ success: false, error: 'QuickBooks not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = integration.quickbooks_tokens;
    const apiBase = `${getApiBase()}/${tokens.realmId}`;

    // Helper to make QB API calls
    const qbFetch = async (endpoint: string, options: RequestInit = {}) => {
      const response = await fetch(`${apiBase}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('QB API error:', errorText);
        throw new Error(`QB API error: ${response.status}`);
      }

      return response.json();
    };

    switch (action) {
      case 'syncCustomer': {
        const { customer } = params;
        
        // First, try to find existing customer by name
        const displayName = `${customer.firstName} ${customer.lastName}`;
        const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}'`);
        
        const searchResult = await qbFetch(`/query?query=${query}`);
        
        if (searchResult.QueryResponse?.Customer?.length > 0) {
          // Customer exists
          const qbCustomer = searchResult.QueryResponse.Customer[0];
          
          // Update customer mapping in our DB
          await supabase
            .from('customer_integrations')
            .upsert({
              customer_id: customer.id,
              organization_id: orgId,
              quickbooks_id: qbCustomer.Id,
              updated_at: new Date().toISOString(),
            });

          return new Response(
            JSON.stringify({ success: true, qbId: qbCustomer.Id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new customer
        const newCustomer = {
          DisplayName: displayName,
          PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
          PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
          BillAddr: customer.address ? {
            Line1: customer.address.street,
            City: customer.address.city,
            CountrySubDivisionCode: customer.address.state,
            PostalCode: customer.address.zip,
          } : undefined,
        };

        const createResult = await qbFetch('/customer', {
          method: 'POST',
          body: JSON.stringify(newCustomer),
        });

        // Store mapping
        await supabase
          .from('customer_integrations')
          .upsert({
            customer_id: customer.id,
            organization_id: orgId,
            quickbooks_id: createResult.Customer.Id,
            updated_at: new Date().toISOString(),
          });

        return new Response(
          JSON.stringify({ success: true, qbId: createResult.Customer.Id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createInvoice': {
        const { invoice } = params;

        // Get QB customer ID
        const { data: customerMapping } = await supabase
          .from('customer_integrations')
          .select('quickbooks_id')
          .eq('customer_id', invoice.customerId)
          .eq('organization_id', orgId)
          .single();

        if (!customerMapping?.quickbooks_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer not synced to QuickBooks' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const qbInvoice = {
          CustomerRef: { value: customerMapping.quickbooks_id },
          Line: invoice.lines.map((line: any, index: number) => ({
            Id: String(index + 1),
            Description: line.description,
            Amount: line.amount,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              Qty: line.quantity || 1,
              UnitPrice: line.unitPrice || line.amount,
            },
          })),
          DueDate: invoice.dueDate,
          PrivateNote: invoice.privateNote,
          CustomerMemo: invoice.memo ? { value: invoice.memo } : undefined,
        };

        const createResult = await qbFetch('/invoice', {
          method: 'POST',
          body: JSON.stringify(qbInvoice),
        });

        // Store invoice mapping
        await supabase
          .from('invoice_integrations')
          .insert({
            property_id: invoice.propertyId,
            organization_id: orgId,
            quickbooks_id: createResult.Invoice.Id,
            quickbooks_doc_number: createResult.Invoice.DocNumber,
            total_amount: createResult.Invoice.TotalAmt,
            created_at: new Date().toISOString(),
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            qbId: createResult.Invoice.Id,
            docNumber: createResult.Invoice.DocNumber,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createInvoiceFromTime': {
        const { propertyId, timeEntryIds, options } = params;

        // Get time entries
        const { data: timeEntries, error: timeError } = await supabase
          .from('time_entries')
          .select('*, properties(customer_id, street, city)')
          .in('id', timeEntryIds);

        if (timeError || !timeEntries?.length) {
          return new Response(
            JSON.stringify({ success: false, error: 'Time entries not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get customer QB ID
        const customerId = timeEntries[0].properties?.customer_id;
        const { data: customerMapping } = await supabase
          .from('customer_integrations')
          .select('quickbooks_id')
          .eq('customer_id', customerId)
          .eq('organization_id', orgId)
          .single();

        if (!customerMapping?.quickbooks_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer not synced to QuickBooks' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Build invoice lines
        const lines: any[] = [];
        let totalMileage = 0;

        if (options?.includeLineItems) {
          // Break out each entry
          timeEntries.forEach((entry: any, i: number) => {
            const hours = (entry.total_duration || 0) / 1000 / 60 / 60;
            lines.push({
              Id: String(i + 1),
              Description: `Service call - ${new Date(entry.start_time).toLocaleDateString()}`,
              Amount: hours * entry.hourly_rate,
              DetailType: 'SalesItemLineDetail',
              SalesItemLineDetail: {
                Qty: Number(hours.toFixed(2)),
                UnitPrice: entry.hourly_rate,
              },
            });
            totalMileage += entry.mileage || 0;
          });
        } else {
          // Single line item
          const totalHours = timeEntries.reduce((sum: number, e: any) => 
            sum + ((e.total_duration || 0) / 1000 / 60 / 60), 0);
          const avgRate = timeEntries[0].hourly_rate || 40;
          
          lines.push({
            Id: '1',
            Description: 'Service work',
            Amount: totalHours * avgRate,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              Qty: Number(totalHours.toFixed(2)),
              UnitPrice: avgRate,
            },
          });
          
          totalMileage = timeEntries.reduce((sum: number, e: any) => sum + (e.mileage || 0), 0);
        }

        // Add mileage line if requested
        if (options?.addMileage && totalMileage > 0) {
          const mileageRate = timeEntries[0].mileage_rate || 0.67;
          lines.push({
            Id: String(lines.length + 1),
            Description: 'Mileage',
            Amount: totalMileage * mileageRate,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              Qty: totalMileage,
              UnitPrice: mileageRate,
            },
          });
        }

        const property = timeEntries[0].properties;
        const qbInvoice = {
          CustomerRef: { value: customerMapping.quickbooks_id },
          Line: lines,
          CustomerMemo: { value: `Service at ${property?.street}, ${property?.city}` },
        };

        const createResult = await qbFetch('/invoice', {
          method: 'POST',
          body: JSON.stringify(qbInvoice),
        });

        // Store mapping
        await supabase
          .from('invoice_integrations')
          .insert({
            property_id: propertyId,
            organization_id: orgId,
            quickbooks_id: createResult.Invoice.Id,
            quickbooks_doc_number: createResult.Invoice.DocNumber,
            total_amount: createResult.Invoice.TotalAmt,
            time_entry_ids: timeEntryIds,
            created_at: new Date().toISOString(),
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            qbId: createResult.Invoice.Id,
            docNumber: createResult.Invoice.DocNumber,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getInvoiceStatus': {
        const { qbInvoiceId } = params;

        const result = await qbFetch(`/invoice/${qbInvoiceId}`);
        const invoice = result.Invoice;

        let status: string;
        if (invoice.Balance === 0) {
          status = 'paid';
        } else if (invoice.EmailStatus === 'EmailSent') {
          const dueDate = new Date(invoice.DueDate);
          status = dueDate < new Date() ? 'overdue' : 'sent';
        } else {
          status = 'draft';
        }

        return new Response(
          JSON.stringify({ status, balance: invoice.Balance }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sendInvoice': {
        const { qbInvoiceId, email } = params;

        const endpoint = email 
          ? `/invoice/${qbInvoiceId}/send?sendTo=${encodeURIComponent(email)}`
          : `/invoice/${qbInvoiceId}/send`;

        await qbFetch(endpoint, { method: 'POST' });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (err) {
    console.error('QuickBooks sync error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
