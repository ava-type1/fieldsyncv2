import { supabase } from './supabase';
import { formatPhone, formatPhaseName, formatDate } from './utils';
import type { Property, User, Phase, Customer } from '../types';

// ============================================================================
// Types
// ============================================================================

export type NotificationEventType =
  | 'on_my_way'
  | 'phase_complete'
  | 'ready_for_inspection'
  | 'tech_new_assignment'
  | 'walkthrough_scheduled';

export interface SMSNotification {
  id: string;
  to: string;
  message: string;
  eventType: NotificationEventType;
  customerId?: string;
  propertyId?: string;
  phaseId?: string;
  userId?: string;
  status: 'pending' | 'sent' | 'failed' | 'rate_limited';
  twilioSid?: string;
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
}

export interface NotificationPreferences {
  id: string;
  customerId: string;
  enabled: boolean;
  onMyWay: boolean;
  phaseComplete: boolean;
  readyForInspection: boolean;
  walkthroughScheduled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SendSMSResponse {
  success: boolean;
  messageSid?: string;
  error?: string;
  rateLimited?: boolean;
}

// ============================================================================
// Rate Limiting
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if we can send an SMS to a customer for a specific event type.
 * Returns true if allowed, false if rate limited.
 */
async function checkRateLimit(
  customerId: string,
  eventType: NotificationEventType
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  try {
    const { data, error } = await supabase
      .from('sms_notifications')
      .select('id')
      .eq('customer_id', customerId)
      .eq('event_type', eventType)
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo)
      .limit(1);

    if (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error to not block notifications
    }

    return !data || data.length === 0;
  } catch (err) {
    console.error('Rate limit check error:', err);
    return true;
  }
}

/**
 * Record an SMS notification attempt in the database.
 */
async function recordNotification(
  notification: Omit<SMSNotification, 'id' | 'createdAt'>
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('sms_notifications')
      .insert({
        to_phone: notification.to,
        message: notification.message,
        event_type: notification.eventType,
        customer_id: notification.customerId,
        property_id: notification.propertyId,
        phase_id: notification.phaseId,
        user_id: notification.userId,
        status: notification.status,
        twilio_sid: notification.twilioSid,
        error_message: notification.errorMessage,
        sent_at: notification.sentAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to record notification:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('Record notification error:', err);
    return null;
  }
}

/**
 * Update notification status after send attempt.
 */
async function updateNotificationStatus(
  id: string,
  status: SMSNotification['status'],
  twilioSid?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('sms_notifications')
      .update({
        status,
        twilio_sid: twilioSid,
        error_message: errorMessage,
        sent_at: status === 'sent' ? new Date().toISOString() : undefined,
      })
      .eq('id', id);
  } catch (err) {
    console.error('Update notification status error:', err);
  }
}

// ============================================================================
// Core Send Function
// ============================================================================

/**
 * Send an SMS via the Supabase Edge Function.
 * This keeps Twilio credentials secure on the server side.
 */
export async function sendSMS(
  to: string,
  message: string,
  options?: {
    customerId?: string;
    propertyId?: string;
    phaseId?: string;
    userId?: string;
    eventType?: NotificationEventType;
    skipRateLimit?: boolean;
  }
): Promise<SendSMSResponse> {
  const eventType = options?.eventType || 'on_my_way';
  const customerId = options?.customerId;

  // Check rate limit if we have a customer ID
  if (customerId && !options?.skipRateLimit) {
    const allowed = await checkRateLimit(customerId, eventType);
    if (!allowed) {
      console.log(`Rate limited: ${eventType} for customer ${customerId}`);
      await recordNotification({
        to,
        message,
        eventType,
        customerId,
        propertyId: options?.propertyId,
        phaseId: options?.phaseId,
        userId: options?.userId,
        status: 'rate_limited',
      });
      return { success: false, rateLimited: true, error: 'Rate limited' };
    }
  }

  // Record the pending notification
  const notificationId = await recordNotification({
    to,
    message,
    eventType,
    customerId,
    propertyId: options?.propertyId,
    phaseId: options?.phaseId,
    userId: options?.userId,
    status: 'pending',
  });

  try {
    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        to: cleanPhoneNumber(to),
        message,
      },
    });

    if (error) {
      console.error('SMS send error:', error);
      if (notificationId) {
        await updateNotificationStatus(notificationId, 'failed', undefined, error.message);
      }
      return { success: false, error: error.message };
    }

    if (data?.success && notificationId) {
      await updateNotificationStatus(notificationId, 'sent', data.messageSid);
    } else if (notificationId) {
      await updateNotificationStatus(notificationId, 'failed', undefined, data?.error);
    }

    return {
      success: data?.success || false,
      messageSid: data?.messageSid,
      error: data?.error,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('SMS send exception:', err);
    if (notificationId) {
      await updateNotificationStatus(notificationId, 'failed', undefined, errorMessage);
    }
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Message Templates
// ============================================================================

const MESSAGE_TEMPLATES = {
  on_my_way: (property: Property, techName: string) =>
    `Hi! Your technician ${techName} is on the way to ${property.street}. ` +
    `Expected arrival: ~${getEstimatedArrival()} - FieldSync`,

  phase_complete: (property: Property, phase: Phase) =>
    `Great news! The ${formatPhaseName(phase.type)} phase has been completed at ` +
    `${property.street}. We'll keep you updated on the next steps. - FieldSync`,

  ready_for_inspection: (property: Property, date?: string) =>
    `Your property at ${property.street} is ready for inspection! ` +
    (date ? `Scheduled for ${formatDate(date)}. ` : '') +
    `Please contact us with any questions. - FieldSync`,

  walkthrough_scheduled: (property: Property, date?: string) =>
    `Your walkthrough at ${property.street} has been scheduled` +
    (date ? ` for ${formatDate(date)}` : '') +
    `. We look forward to seeing you! - FieldSync`,

  tech_new_assignment: (property: Property, phase?: Phase) =>
    `New assignment: ${property.street}, ${property.city}. ` +
    (phase ? `Task: ${formatPhaseName(phase.type)}. ` : '') +
    `Open FieldSync for details.`,
};

function getEstimatedArrival(): string {
  const now = new Date();
  // Add 15-30 minutes as a rough ETA
  const eta = new Date(now.getTime() + 20 * 60 * 1000);
  return eta.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function cleanPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Add +1 if it's a 10-digit US number
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // Add + if it's 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  // Return as-is with + prefix
  return digits.startsWith('+') ? digits : `+${digits}`;
}

// ============================================================================
// Customer Notification Preferences
// ============================================================================

/**
 * Get notification preferences for a customer.
 */
export async function getNotificationPreferences(
  customerId: string
): Promise<NotificationPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Get preferences error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      enabled: data.enabled,
      onMyWay: data.on_my_way,
      phaseComplete: data.phase_complete,
      readyForInspection: data.ready_for_inspection,
      walkthroughScheduled: data.walkthrough_scheduled,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error('Get preferences exception:', err);
    return null;
  }
}

/**
 * Update notification preferences for a customer.
 */
export async function updateNotificationPreferences(
  customerId: string,
  preferences: Partial<Omit<NotificationPreferences, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        customer_id: customerId,
        enabled: preferences.enabled,
        on_my_way: preferences.onMyWay,
        phase_complete: preferences.phaseComplete,
        ready_for_inspection: preferences.readyForInspection,
        walkthrough_scheduled: preferences.walkthroughScheduled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id',
      });

    if (error) {
      console.error('Update preferences error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Update preferences exception:', err);
    return false;
  }
}

/**
 * Check if a specific notification type is enabled for a customer.
 */
async function isNotificationEnabled(
  customerId: string,
  eventType: NotificationEventType
): Promise<boolean> {
  const prefs = await getNotificationPreferences(customerId);
  
  // If no preferences exist, default to enabled
  if (!prefs) return true;
  
  // Check master toggle
  if (!prefs.enabled) return false;
  
  // Check specific event type
  switch (eventType) {
    case 'on_my_way':
      return prefs.onMyWay;
    case 'phase_complete':
      return prefs.phaseComplete;
    case 'ready_for_inspection':
      return prefs.readyForInspection;
    case 'walkthrough_scheduled':
      return prefs.walkthroughScheduled;
    case 'tech_new_assignment':
      return true; // Always send to techs
    default:
      return true;
  }
}

// ============================================================================
// High-Level Notification Functions
// ============================================================================

/**
 * Notify customer that technician is on the way.
 */
export async function notifyCustomerOnMyWay(
  property: Property,
  techName: string
): Promise<SendSMSResponse> {
  const customer = property.customer;
  
  if (!customer?.phone) {
    return { success: false, error: 'Customer phone not available' };
  }

  // Check if notifications are enabled
  const enabled = await isNotificationEnabled(customer.id, 'on_my_way');
  if (!enabled) {
    return { success: false, error: 'Notifications disabled for this customer' };
  }

  const message = MESSAGE_TEMPLATES.on_my_way(property, techName);
  
  return sendSMS(customer.phone, message, {
    customerId: customer.id,
    propertyId: property.id,
    eventType: 'on_my_way',
  });
}

/**
 * Notify customer that a phase has been completed.
 */
export async function notifyCustomerPhaseComplete(
  property: Property,
  phase: Phase
): Promise<SendSMSResponse> {
  const customer = property.customer;
  
  if (!customer?.phone) {
    return { success: false, error: 'Customer phone not available' };
  }

  const enabled = await isNotificationEnabled(customer.id, 'phase_complete');
  if (!enabled) {
    return { success: false, error: 'Notifications disabled for this customer' };
  }

  const message = MESSAGE_TEMPLATES.phase_complete(property, phase);
  
  return sendSMS(customer.phone, message, {
    customerId: customer.id,
    propertyId: property.id,
    phaseId: phase.id,
    eventType: 'phase_complete',
  });
}

/**
 * Notify customer that property is ready for inspection.
 */
export async function notifyCustomerReadyForInspection(
  property: Property,
  scheduledDate?: string
): Promise<SendSMSResponse> {
  const customer = property.customer;
  
  if (!customer?.phone) {
    return { success: false, error: 'Customer phone not available' };
  }

  const enabled = await isNotificationEnabled(customer.id, 'ready_for_inspection');
  if (!enabled) {
    return { success: false, error: 'Notifications disabled for this customer' };
  }

  const message = MESSAGE_TEMPLATES.ready_for_inspection(property, scheduledDate);
  
  return sendSMS(customer.phone, message, {
    customerId: customer.id,
    propertyId: property.id,
    eventType: 'ready_for_inspection',
  });
}

/**
 * Notify customer that walkthrough is scheduled.
 */
export async function notifyCustomerWalkthroughScheduled(
  property: Property,
  scheduledDate?: string
): Promise<SendSMSResponse> {
  const customer = property.customer;
  
  if (!customer?.phone) {
    return { success: false, error: 'Customer phone not available' };
  }

  const enabled = await isNotificationEnabled(customer.id, 'walkthrough_scheduled');
  if (!enabled) {
    return { success: false, error: 'Notifications disabled for this customer' };
  }

  const message = MESSAGE_TEMPLATES.walkthrough_scheduled(property, scheduledDate);
  
  return sendSMS(customer.phone, message, {
    customerId: customer.id,
    propertyId: property.id,
    eventType: 'walkthrough_scheduled',
  });
}

/**
 * Notify technician of a new assignment.
 */
export async function notifyTechNewAssignment(
  user: User,
  property: Property,
  phase?: Phase
): Promise<SendSMSResponse> {
  if (!user.phone) {
    return { success: false, error: 'Technician phone not available' };
  }

  const message = MESSAGE_TEMPLATES.tech_new_assignment(property, phase);
  
  return sendSMS(user.phone, message, {
    userId: user.id,
    propertyId: property.id,
    phaseId: phase?.id,
    eventType: 'tech_new_assignment',
    skipRateLimit: true, // Don't rate limit tech assignments
  });
}

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Send a test SMS to verify configuration.
 */
export async function sendTestSMS(
  to: string,
  eventType: NotificationEventType = 'on_my_way'
): Promise<SendSMSResponse> {
  const testMessages: Record<NotificationEventType, string> = {
    on_my_way: 'Test notification: Your technician is on the way! - FieldSync',
    phase_complete: 'Test notification: Phase completed! - FieldSync',
    ready_for_inspection: 'Test notification: Ready for inspection! - FieldSync',
    walkthrough_scheduled: 'Test notification: Walkthrough scheduled! - FieldSync',
    tech_new_assignment: 'Test notification: New assignment! - FieldSync',
  };

  return sendSMS(to, testMessages[eventType], {
    eventType,
    skipRateLimit: true,
  });
}

/**
 * Get notification history for a property.
 */
export async function getNotificationHistory(
  propertyId: string,
  limit: number = 20
): Promise<SMSNotification[]> {
  try {
    const { data, error } = await supabase
      .from('sms_notifications')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get notification history error:', error);
      return [];
    }

    return (data || []).map((n) => ({
      id: n.id,
      to: n.to_phone,
      message: n.message,
      eventType: n.event_type,
      customerId: n.customer_id,
      propertyId: n.property_id,
      phaseId: n.phase_id,
      userId: n.user_id,
      status: n.status,
      twilioSid: n.twilio_sid,
      errorMessage: n.error_message,
      createdAt: n.created_at,
      sentAt: n.sent_at,
    }));
  } catch (err) {
    console.error('Get notification history exception:', err);
    return [];
  }
}
