import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { getNotificationHistory, type SMSNotification, type NotificationEventType } from '../../lib/notifications';
import { formatRelativeDate, cn } from '../../lib/utils';

interface NotificationHistoryProps {
  propertyId: string;
  limit?: number;
  className?: string;
}

const eventTypeLabels: Record<NotificationEventType, string> = {
  on_my_way: 'On My Way',
  phase_complete: 'Phase Complete',
  ready_for_inspection: 'Ready for Inspection',
  walkthrough_scheduled: 'Walkthrough Scheduled',
  tech_new_assignment: 'Tech Assignment',
};

const statusConfig: Record<SMSNotification['status'], { icon: typeof CheckCircle; color: string; label: string }> = {
  sent: { icon: CheckCircle, color: 'text-green-500', label: 'Sent' },
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  rate_limited: { icon: AlertTriangle, color: 'text-orange-500', label: 'Rate Limited' },
};

export function NotificationHistory({ propertyId, limit = 10, className }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<SMSNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const history = await getNotificationHistory(propertyId, limit);
        setNotifications(history);
      } catch (err) {
        console.error('Failed to load notification history:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [propertyId, limit]);

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card className={cn('p-6 text-center', className)}>
        <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No SMS notifications sent yet</p>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          SMS History
        </h3>
      </div>
      
      <div className="divide-y divide-gray-100">
        {notifications.map((notification) => {
          const status = statusConfig[notification.status];
          const StatusIcon = status.icon;

          return (
            <div key={notification.id} className="p-4">
              <div className="flex items-start gap-3">
                <StatusIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', status.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {eventTypeLabels[notification.eventType]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeDate(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    To: {notification.to}
                  </p>
                  {notification.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">
                      Error: {notification.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
