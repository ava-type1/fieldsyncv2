import { useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  notifyCustomerOnMyWay,
  notifyCustomerPhaseComplete,
  notifyCustomerReadyForInspection,
  notifyCustomerWalkthroughScheduled,
  notifyTechNewAssignment,
  getNotificationHistory,
  type SMSNotification,
} from '../lib/notifications';
import type { Property, Phase, User } from '../types';

interface UseNotificationsReturn {
  // Notification functions
  sendOnMyWay: (property: Property) => Promise<boolean>;
  sendPhaseComplete: (property: Property, phase: Phase) => Promise<boolean>;
  sendReadyForInspection: (property: Property, scheduledDate?: string) => Promise<boolean>;
  sendWalkthroughScheduled: (property: Property, scheduledDate?: string) => Promise<boolean>;
  sendTechAssignment: (user: User, property: Property, phase?: Phase) => Promise<boolean>;

  // History
  getHistory: (propertyId: string) => Promise<SMSNotification[]>;

  // State
  sending: boolean;
  lastError: string | null;
}

/**
 * Hook for managing SMS notifications in workflows.
 * Provides convenience wrappers around notification functions with
 * loading state and error handling.
 */
export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuthStore();
  const [sending, setSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Notify customer that technician is on the way.
   * Call this when tech starts travel (e.g., from TimeTracker).
   */
  const sendOnMyWay = useCallback(async (property: Property): Promise<boolean> => {
    if (!property.customer?.phone) {
      setLastError('Customer phone not available');
      return false;
    }

    setSending(true);
    setLastError(null);

    try {
      const techName = user?.fullName || 'Your technician';
      const result = await notifyCustomerOnMyWay(property, techName);

      if (!result.success) {
        if (result.rateLimited) {
          // Rate limited is not an error per se
          console.log('On my way notification rate limited');
          return true;
        }
        setLastError(result.error || 'Failed to send notification');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification';
      setLastError(message);
      return false;
    } finally {
      setSending(false);
    }
  }, [user]);

  /**
   * Notify customer that a phase has been completed.
   * Call this when a phase is marked complete.
   */
  const sendPhaseComplete = useCallback(async (
    property: Property,
    phase: Phase
  ): Promise<boolean> => {
    if (!property.customer?.phone) {
      setLastError('Customer phone not available');
      return false;
    }

    setSending(true);
    setLastError(null);

    try {
      const result = await notifyCustomerPhaseComplete(property, phase);

      if (!result.success) {
        if (result.rateLimited) {
          console.log('Phase complete notification rate limited');
          return true;
        }
        setLastError(result.error || 'Failed to send notification');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification';
      setLastError(message);
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  /**
   * Notify customer that property is ready for inspection.
   * Call this when inspection phase is scheduled or ready.
   */
  const sendReadyForInspection = useCallback(async (
    property: Property,
    scheduledDate?: string
  ): Promise<boolean> => {
    if (!property.customer?.phone) {
      setLastError('Customer phone not available');
      return false;
    }

    setSending(true);
    setLastError(null);

    try {
      const result = await notifyCustomerReadyForInspection(property, scheduledDate);

      if (!result.success) {
        if (result.rateLimited) {
          console.log('Ready for inspection notification rate limited');
          return true;
        }
        setLastError(result.error || 'Failed to send notification');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification';
      setLastError(message);
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  /**
   * Notify customer that walkthrough is scheduled.
   * Call this when scheduling a walkthrough.
   */
  const sendWalkthroughScheduled = useCallback(async (
    property: Property,
    scheduledDate?: string
  ): Promise<boolean> => {
    if (!property.customer?.phone) {
      setLastError('Customer phone not available');
      return false;
    }

    setSending(true);
    setLastError(null);

    try {
      const result = await notifyCustomerWalkthroughScheduled(property, scheduledDate);

      if (!result.success) {
        if (result.rateLimited) {
          console.log('Walkthrough scheduled notification rate limited');
          return true;
        }
        setLastError(result.error || 'Failed to send notification');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification';
      setLastError(message);
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  /**
   * Notify technician of a new assignment.
   * Call this when assigning a phase to a tech.
   */
  const sendTechAssignment = useCallback(async (
    targetUser: User,
    property: Property,
    phase?: Phase
  ): Promise<boolean> => {
    if (!targetUser.phone) {
      setLastError('Technician phone not available');
      return false;
    }

    setSending(true);
    setLastError(null);

    try {
      const result = await notifyTechNewAssignment(targetUser, property, phase);

      if (!result.success) {
        setLastError(result.error || 'Failed to send notification');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification';
      setLastError(message);
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  /**
   * Get notification history for a property.
   */
  const getHistory = useCallback(async (propertyId: string): Promise<SMSNotification[]> => {
    try {
      return await getNotificationHistory(propertyId);
    } catch (err) {
      console.error('Failed to get notification history:', err);
      return [];
    }
  }, []);

  return {
    sendOnMyWay,
    sendPhaseComplete,
    sendReadyForInspection,
    sendWalkthroughScheduled,
    sendTechAssignment,
    getHistory,
    sending,
    lastError,
  };
}
