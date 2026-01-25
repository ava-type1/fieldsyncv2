import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  BellOff, 
  MessageSquare, 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Car,
  ClipboardCheck,
  Search,
  Calendar
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences,
  sendTestSMS,
  type NotificationPreferences,
  type NotificationEventType
} from '../../lib/notifications';
import { formatPhone, cn } from '../../lib/utils';
import type { Customer } from '../../types';

interface NotificationSettingsProps {
  customer: Customer;
  onClose?: () => void;
  className?: string;
}

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function Toggle({ enabled, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        enabled ? 'bg-primary-600' : 'bg-gray-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

interface NotificationTypeRowProps {
  icon: typeof Bell;
  label: string;
  description: string;
  preview: string;
  enabled: boolean;
  masterEnabled: boolean;
  onChange: (enabled: boolean) => void;
  onTest: () => void;
  testLoading: boolean;
}

function NotificationTypeRow({
  icon: Icon,
  label,
  description,
  preview,
  enabled,
  masterEnabled,
  onChange,
  onTest,
  testLoading,
}: NotificationTypeRowProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0 py-4">
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          enabled && masterEnabled ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
        )}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900">{label}</p>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
            <Toggle 
              enabled={enabled} 
              onChange={onChange} 
              disabled={!masterEnabled}
            />
          </div>
          
          {/* Preview Section */}
          <div className="mt-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            
            {showPreview && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 italic">{preview}</p>
                </div>
                
                {enabled && masterEnabled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onTest}
                    disabled={testLoading}
                    className="mt-3"
                  >
                    {testLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Send Test
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationSettings({ customer, onClose, className }: NotificationSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState<NotificationEventType | null>(null);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    id: '',
    customerId: customer.id,
    enabled: true,
    onMyWay: true,
    phaseComplete: true,
    readyForInspection: true,
    walkthroughScheduled: true,
    createdAt: '',
    updatedAt: '',
  });

  const [testPhone, setTestPhone] = useState(customer.phone || '');

  // Load existing preferences
  useEffect(() => {
    async function loadPreferences() {
      setLoading(true);
      try {
        const prefs = await getNotificationPreferences(customer.id);
        if (prefs) {
          setPreferences(prefs);
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadPreferences();
  }, [customer.id]);

  // Save preferences
  const handleSave = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    setSaving(true);
    setTestResult(null);
    
    const updatedPrefs = { ...preferences, ...newPrefs };
    setPreferences(updatedPrefs);
    
    try {
      const success = await updateNotificationPreferences(customer.id, {
        enabled: updatedPrefs.enabled,
        onMyWay: updatedPrefs.onMyWay,
        phaseComplete: updatedPrefs.phaseComplete,
        readyForInspection: updatedPrefs.readyForInspection,
        walkthroughScheduled: updatedPrefs.walkthroughScheduled,
      });
      
      if (!success) {
        setTestResult({ type: 'error', message: 'Failed to save preferences' });
      }
    } catch (err) {
      console.error('Save error:', err);
      setTestResult({ type: 'error', message: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  }, [customer.id, preferences]);

  // Send test SMS
  const handleTestSMS = useCallback(async (eventType: NotificationEventType) => {
    if (!testPhone) {
      setTestResult({ type: 'error', message: 'Please enter a phone number' });
      return;
    }

    setTestLoading(eventType);
    setTestResult(null);

    try {
      const result = await sendTestSMS(testPhone, eventType);
      
      if (result.success) {
        setTestResult({ type: 'success', message: 'Test SMS sent successfully!' });
      } else {
        setTestResult({ type: 'error', message: result.error || 'Failed to send test SMS' });
      }
    } catch (err) {
      console.error('Test SMS error:', err);
      setTestResult({ type: 'error', message: 'Failed to send test SMS' });
    } finally {
      setTestLoading(null);
    }
  }, [testPhone]);

  const notificationTypes = [
    {
      key: 'onMyWay' as const,
      eventType: 'on_my_way' as NotificationEventType,
      icon: Car,
      label: 'Technician On The Way',
      description: 'Notify when a technician starts traveling to the property',
      preview: `Hi! Your technician John is on the way to ${customer.firstName}'s property. Expected arrival: ~2:30 PM - FieldSync`,
    },
    {
      key: 'phaseComplete' as const,
      eventType: 'phase_complete' as NotificationEventType,
      icon: ClipboardCheck,
      label: 'Phase Completed',
      description: 'Notify when a service phase is marked complete',
      preview: `Great news! The Electrical Hookup phase has been completed. We'll keep you updated on the next steps. - FieldSync`,
    },
    {
      key: 'readyForInspection' as const,
      eventType: 'ready_for_inspection' as NotificationEventType,
      icon: Search,
      label: 'Ready for Inspection',
      description: 'Notify when property is ready for inspection',
      preview: `Your property is ready for inspection! Scheduled for Jan 25, 2025. Please contact us with any questions. - FieldSync`,
    },
    {
      key: 'walkthroughScheduled' as const,
      eventType: 'walkthrough_scheduled' as NotificationEventType,
      icon: Calendar,
      label: 'Walkthrough Scheduled',
      description: 'Notify when a walkthrough is scheduled',
      preview: `Your walkthrough has been scheduled for Jan 26, 2025. We look forward to seeing you! - FieldSync`,
    },
  ];

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      {/* Header */}
      <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              preferences.enabled ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
            )}>
              {preferences.enabled ? (
                <Bell className="w-5 h-5" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">SMS Notifications</h3>
              <p className="text-sm text-gray-500">
                {customer.firstName} {customer.lastName} • {formatPhone(customer.phone)}
              </p>
            </div>
          </div>
          
          <Toggle
            enabled={preferences.enabled}
            onChange={(enabled) => handleSave({ enabled })}
          />
        </div>
      </div>

      {/* Result Message */}
      {testResult && (
        <div className={cn(
          'px-4 py-3 flex items-center gap-2',
          testResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {testResult.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{testResult.message}</span>
        </div>
      )}

      {/* Test Phone Input */}
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Test Phone Number
        </label>
        <Input
          type="tel"
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use this number to send test messages
        </p>
      </div>

      {/* Notification Types */}
      <div className="px-4">
        {notificationTypes.map((type) => (
          <NotificationTypeRow
            key={type.key}
            icon={type.icon}
            label={type.label}
            description={type.description}
            preview={type.preview}
            enabled={preferences[type.key]}
            masterEnabled={preferences.enabled}
            onChange={(enabled) => handleSave({ [type.key]: enabled })}
            onTest={() => handleTestSMS(type.eventType)}
            testLoading={testLoading === type.eventType}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Rate limit: Max 1 SMS per hour for same event type
          </p>
          {saving && (
            <span className="text-xs text-primary-600 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Export a simple inline notification toggle for use in lists
interface NotificationToggleProps {
  customerId: string;
  initialEnabled?: boolean;
  onChange?: (enabled: boolean) => void;
}

export function NotificationToggle({ customerId, initialEnabled = true, onChange }: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const newValue = !enabled;
    setEnabled(newValue);
    
    try {
      await updateNotificationPreferences(customerId, { enabled: newValue });
      onChange?.(newValue);
    } catch (err) {
      console.error('Toggle error:', err);
      setEnabled(!newValue); // Revert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors',
        enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        loading && 'opacity-50'
      )}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : enabled ? (
        <Bell className="w-3 h-3" />
      ) : (
        <BellOff className="w-3 h-3" />
      )}
      {enabled ? 'SMS On' : 'SMS Off'}
    </button>
  );
}
