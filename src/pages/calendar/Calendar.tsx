import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, User } from 'lucide-react';
import { usePropertyStore } from '../../stores/propertyStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import type { Phase, Property } from '../../types';

interface ScheduledJob {
  phase: Phase;
  property: Property;
}

export function Calendar() {
  const navigate = useNavigate();
  const { properties } = usePropertyStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get all scheduled phases with their properties
  const scheduledJobs = useMemo(() => {
    const jobs: ScheduledJob[] = [];
    properties.forEach(property => {
      property.phases?.forEach(phase => {
        if (phase.scheduledDate) {
          jobs.push({ phase, property });
        }
      });
    });
    return jobs;
  }, [properties]);

  // Get jobs for a specific date
  const getJobsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduledJobs.filter(job => job.phase.scheduledDate?.startsWith(dateStr));
  };

  // Calendar navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days: (Date | null)[] = [];
    
    // Add padding for days before the 1st
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentDate]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Selected date for detail view
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const selectedJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  const formatPhaseType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-purple-100 text-purple-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-primary-600" />
          Schedule
        </h1>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Month Navigation */}
      <Card className="mb-4">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={goToPrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">{monthName}</h2>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-t border-gray-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-t border-gray-100">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="min-h-[80px] bg-gray-50" />;
            }

            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate && dateStr === selectedDate.toISOString().split('T')[0];
            const dayJobs = getJobsForDate(date);
            const hasJobs = dayJobs.length > 0;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(date)}
                className={`min-h-[80px] p-1 border-t border-l border-gray-100 text-left transition-colors hover:bg-gray-50 ${
                  isSelected ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset' : ''
                }`}
              >
                <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-700'
                }`}>
                  {date.getDate()}
                </div>
                {hasJobs && (
                  <div className="space-y-1">
                    {dayJobs.slice(0, 2).map(job => (
                      <div
                        key={job.phase.id}
                        className="text-xs px-1 py-0.5 rounded bg-primary-100 text-primary-700 truncate"
                      >
                        {formatPhaseType(job.phase.type)}
                      </div>
                    ))}
                    {dayJobs.length > 2 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayJobs.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && (
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h3>
            <p className="text-sm text-gray-500">
              {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>

          {selectedJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No jobs scheduled for this day</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {selectedJobs.map(({ phase, property }) => (
                <button
                  key={phase.id}
                  onClick={() => navigate(`/properties/${property.id}`)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(phase.status)}`}>
                        {formatPhaseType(phase.type)}
                      </span>
                    </div>
                    {phase.scheduledTimeWindow && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {phase.scheduledTimeWindow}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-gray-900 font-medium mb-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {property.street}
                  </div>
                  
                  {property.city && (
                    <p className="text-sm text-gray-500 ml-5">
                      {property.city}, {property.state}
                    </p>
                  )}

                  {phase.assignedUser && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
                      <User className="w-4 h-4 text-gray-400" />
                      {phase.assignedUser.fullName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Quick Stats */}
      {!selectedDate && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Upcoming This Week</h3>
          {(() => {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const upcomingJobs = scheduledJobs.filter(job => {
              const jobDate = new Date(job.phase.scheduledDate!);
              return jobDate >= today && jobDate <= nextWeek;
            }).sort((a, b) => 
              new Date(a.phase.scheduledDate!).getTime() - new Date(b.phase.scheduledDate!).getTime()
            );

            if (upcomingJobs.length === 0) {
              return (
                <p className="text-gray-500 text-sm">No jobs scheduled in the next 7 days</p>
              );
            }

            return (
              <div className="space-y-2">
                {upcomingJobs.slice(0, 5).map(({ phase, property }) => (
                  <button
                    key={phase.id}
                    onClick={() => navigate(`/properties/${property.id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-12 text-center">
                      <div className="text-xs text-gray-500">
                        {new Date(phase.scheduledDate!).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold text-primary-600">
                        {new Date(phase.scheduledDate!).getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{property.street}</p>
                      <p className="text-sm text-gray-500">{formatPhaseType(phase.type)}</p>
                    </div>
                  </button>
                ))}
                {upcomingJobs.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">
                    +{upcomingJobs.length - 5} more this week
                  </p>
                )}
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}
