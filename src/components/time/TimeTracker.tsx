import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Clock, MapPin, Car, Bell, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../hooks/useNotifications';
import type { Property } from '../../types';

interface TimeEntry {
  id: string;
  propertyId: string;
  phaseId?: string;
  startTime: Date;
  endTime?: Date;
  pausedDuration: number; // milliseconds paused
  status: 'active' | 'paused' | 'completed';
  mileage?: number;
  notes?: string;
  lat?: number;
  lng?: number;
}

interface TimeTrackerProps {
  propertyId: string;
  phaseId?: string;
  hourlyRate?: number;
  mileageRate?: number;
  onSave?: (entry: TimeEntry) => void;
  className?: string;
  /** Property with customer data for SMS notifications */
  property?: Property;
  /** Enable "On My Way" SMS notification when starting travel */
  enableSMSNotification?: boolean;
}

export function TimeTracker({
  propertyId,
  phaseId,
  hourlyRate = 40,
  mileageRate = 0.67, // IRS standard rate 2024
  onSave,
  className,
  property,
  enableSMSNotification = true,
}: TimeTrackerProps) {
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pauseStart, setPauseStart] = useState<Date | null>(null);
  const [mileage, setMileage] = useState('');
  const [showMileage, setShowMileage] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [sendNotification, setSendNotification] = useState(enableSMSNotification);
  const { sendOnMyWay, sending: notificationSending } = useNotifications();

  // Timer update
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (entry?.status === 'active') {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const start = entry.startTime.getTime();
        const paused = entry.pausedDuration;
        setElapsed(now - start - paused);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [entry]);

  const startTimer = useCallback(async () => {
    // Get current location if available
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch {
      // Location unavailable - continue without it
    }

    const newEntry: TimeEntry = {
      id: crypto.randomUUID(),
      propertyId,
      phaseId,
      startTime: new Date(),
      pausedDuration: 0,
      status: 'active',
      lat,
      lng,
    };

    setEntry(newEntry);
    setElapsed(0);

    // Send "On My Way" SMS notification if enabled and property is available
    if (sendNotification && property?.customer) {
      try {
        const success = await sendOnMyWay(property);
        if (success) {
          setNotificationSent(true);
        }
      } catch (err) {
        console.error('Failed to send on my way notification:', err);
      }
    }
  }, [propertyId, phaseId, sendNotification, property, sendOnMyWay]);

  const pauseTimer = useCallback(() => {
    if (!entry || entry.status !== 'active') return;
    
    setPauseStart(new Date());
    setEntry({ ...entry, status: 'paused' });
  }, [entry]);

  const resumeTimer = useCallback(() => {
    if (!entry || entry.status !== 'paused' || !pauseStart) return;
    
    const pauseDuration = new Date().getTime() - pauseStart.getTime();
    setEntry({
      ...entry,
      status: 'active',
      pausedDuration: entry.pausedDuration + pauseDuration,
    });
    setPauseStart(null);
  }, [entry, pauseStart]);

  const stopTimer = useCallback(() => {
    if (!entry) return;
    
    let finalPausedDuration = entry.pausedDuration;
    if (pauseStart) {
      finalPausedDuration += new Date().getTime() - pauseStart.getTime();
    }

    const completedEntry: TimeEntry = {
      ...entry,
      endTime: new Date(),
      pausedDuration: finalPausedDuration,
      status: 'completed',
      mileage: mileage ? parseFloat(mileage) : undefined,
    };

    setEntry(completedEntry);
    setShowMileage(true);
  }, [entry, pauseStart, mileage]);

  const saveEntry = useCallback(() => {
    if (!entry) return;
    
    const finalEntry = {
      ...entry,
      mileage: mileage ? parseFloat(mileage) : undefined,
    };

    onSave?.(finalEntry);
    setEntry(null);
    setElapsed(0);
    setMileage('');
    setShowMileage(false);
  }, [entry, mileage, onSave]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculateEarnings = () => {
    const hours = elapsed / 1000 / 60 / 60;
    const timeEarnings = hours * hourlyRate;
    const mileageEarnings = mileage ? parseFloat(mileage) * mileageRate : 0;
    return {
      time: timeEarnings,
      mileage: mileageEarnings,
      total: timeEarnings + mileageEarnings,
    };
  };

  const earnings = calculateEarnings();

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <Clock className="w-5 h-5 text-gray-500" />
        <span className="font-medium text-gray-900">Time Tracker</span>
        {entry?.lat && (
          <span className="ml-auto flex items-center text-xs text-green-600">
            <MapPin className="w-3 h-3 mr-1" />
            GPS
          </span>
        )}
      </div>

      {/* Timer Display */}
      <div className="p-6">
        <div className="text-center mb-6">
          <div className={cn(
            'text-5xl font-mono font-bold tabular-nums',
            entry?.status === 'active' && 'text-green-600',
            entry?.status === 'paused' && 'text-yellow-600 animate-pulse',
            !entry && 'text-gray-300'
          )}>
            {formatTime(elapsed)}
          </div>
          {entry?.status && (
            <p className="text-sm text-gray-500 mt-2 capitalize">
              {entry.status === 'active' ? 'Recording time...' : entry.status}
            </p>
          )}
        </div>

        {/* Earnings Preview */}
        {entry && elapsed > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Time ({(elapsed / 1000 / 60 / 60).toFixed(2)} hrs × ${hourlyRate})</span>
              <span className="font-medium">${earnings.time.toFixed(2)}</span>
            </div>
            {mileage && parseFloat(mileage) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mileage ({mileage} mi × ${mileageRate.toFixed(2)})</span>
                <span className="font-medium">${earnings.mileage.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
              <span>Estimated Total</span>
              <span className="text-green-600">${earnings.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Mileage Input (shown after stop) */}
        {showMileage && entry?.status === 'completed' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Car className="w-4 h-4 inline mr-1" />
              Round-trip mileage
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="0"
                step="0.1"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="flex items-center px-3 text-gray-500 bg-gray-100 rounded-lg">
                miles
              </span>
            </div>
          </div>
        )}

        {/* SMS Notification Toggle (shown before starting) */}
        {!entry && property?.customer && enableSMSNotification && (
          <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className={cn(
                'w-4 h-4',
                sendNotification ? 'text-primary-600' : 'text-gray-400'
              )} />
              <div>
                <p className="text-sm font-medium text-gray-900">Notify Customer</p>
                <p className="text-xs text-gray-500">Send "On My Way" SMS</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSendNotification(!sendNotification)}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                sendNotification ? 'bg-primary-600' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  sendNotification ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        )}

        {/* Notification Sent Confirmation */}
        {notificationSent && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Customer notified - "On My Way" sent</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!entry && (
            <Button className="flex-1" onClick={startTimer} disabled={notificationSending}>
              <Play className="w-4 h-4 mr-2" />
              {notificationSending ? 'Sending...' : 'Start Timer'}
            </Button>
          )}

          {entry?.status === 'active' && (
            <>
              <Button variant="outline" className="flex-1" onClick={pauseTimer}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={stopTimer}>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          )}

          {entry?.status === 'paused' && (
            <>
              <Button className="flex-1" onClick={resumeTimer}>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
              <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={stopTimer}>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          )}

          {entry?.status === 'completed' && (
            <Button className="flex-1" onClick={saveEntry}>
              Save Time Entry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
