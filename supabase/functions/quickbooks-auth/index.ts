/**
 * QuickBooks OAuth2 Edge Function
 * 
 * Handles token exchange and refresh server-side to keep client_secret secure.
 * 
 * Required env vars:
 * - QUICKBOOKS_CLIENT_ID
 * - QUICKBOOKS_CLIENT_SECRET
 * - QUICKBOOKS_REDIRECT_URI
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, code, refreshToken } = await req.json();

    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    const redirectUri = Deno.env.get('QUICKBOOKS_REDIRECT_URI');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'QuickBooks not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = 'Basic ' + btoa(`${clientId}:${clientSecret}`);

    if (action === 'exchange') {
      // Exchange authorization code for tokens
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(QB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri || '',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('QB token exchange failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Token exchange failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in * 1000),
          realmId: '', // Set by client from URL param
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'refresh') {
      // Refresh expired tokens
      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: 'Missing refresh token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(QB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('QB token refresh failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Token refresh failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in * 1000),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err) {
    console.error('QuickBooks auth error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
