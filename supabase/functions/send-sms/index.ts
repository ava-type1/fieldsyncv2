/**
 * Supabase Edge Function: send-sms
 *
 * Sends SMS messages via Twilio API.
 * This keeps Twilio credentials secure on the server side.
 *
 * Required environment variables (set in Supabase Dashboard > Edge Functions > Secrets):
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID (starts with 'AC')
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 * - TWILIO_PHONE_NUMBER: Your Twilio phone number (format: +1XXXXXXXXXX)
 *
 * To set these in Supabase:
 * 1. Go to your Supabase project dashboard
 * 2. Navigate to Edge Functions > Secrets
 * 3. Add each environment variable
 *
 * Request body:
 * {
 *   "to": "+1XXXXXXXXXX",    // Recipient phone number
 *   "message": "Hello!"      // SMS message content
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "messageSid": "SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
 * }
 * or
 * {
 *   "success": false,
 *   "error": "Error message"
 * }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwilioResponse {
  sid?: string;
  status?: string;
  message?: string;
  code?: number;
}

interface SMSRequest {
  to: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Validate phone number format.
 * Expects E.164 format: +[country code][number]
 */
function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 validation: starts with +, followed by 10-15 digits
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  return e164Regex.test(phone);
}

/**
 * Sanitize message content to prevent injection attacks.
 */
function sanitizeMessage(message: string): string {
  // Remove any control characters
  return message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Send SMS via Twilio REST API.
 */
async function sendTwilioSMS(to: string, message: string): Promise<SMSResponse> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  // Validate environment variables
  if (!accountSid || !authToken || !fromNumber) {
    console.error('Missing Twilio credentials');
    return {
      success: false,
      error: 'Twilio credentials not configured. Please contact support.',
    };
  }

  // Validate phone number
  if (!isValidPhoneNumber(to)) {
    return {
      success: false,
      error: `Invalid phone number format: ${to}. Expected E.164 format (e.g., +15551234567)`,
    };
  }

  // Validate message
  if (!message || message.trim().length === 0) {
    return {
      success: false,
      error: 'Message cannot be empty',
    };
  }

  // Twilio has a 1600 character limit for SMS
  if (message.length > 1600) {
    return {
      success: false,
      error: 'Message exceeds maximum length of 1600 characters',
    };
  }

  const sanitizedMessage = sanitizeMessage(message);

  try {
    // Prepare the request to Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const credentials = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', fromNumber);
    formData.append('Body', sanitizedMessage);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result: TwilioResponse = await response.json();

    if (response.ok && result.sid) {
      console.log(`SMS sent successfully: ${result.sid}`);
      return {
        success: true,
        messageSid: result.sid,
      };
    } else {
      const errorMessage = result.message || 'Unknown Twilio error';
      console.error(`Twilio error: ${result.code} - ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`SMS send exception: ${errorMessage}`);
    return {
      success: false,
      error: 'Failed to send SMS. Please try again later.',
    };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parse request body
    const body: SMSRequest = await req.json();
    const { to, message } = body;

    if (!to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: to, message' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Send the SMS
    const result = await sendTwilioSMS(to, message);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Request handling error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
