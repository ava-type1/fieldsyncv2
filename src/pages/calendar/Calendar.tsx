import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Plus, X, AlertCircle } from 'lucide-react';
import { useProperties, type PropertyWithRelations } from '../../hooks/useProperties';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import type { Phase } from '../../types';

interface ScheduledJob {
  phase: Phase;
  property: PropertyWithRelations;
}

export function Calendar() {
  const navigate = useNavigate();
  const { properties, refetch } = useProperties();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPhaseToSchedule, setSelectedPhaseToSchedule] = useState<{ phase: Phase; property: PropertyWithRelations } | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // Get all phases (scheduled and unscheduled)
  const { scheduledJobs, unscheduledJobs } = useMemo(() => {
    const scheduled: ScheduledJob[] = [];
    const unscheduled: ScheduledJob[] = [];
    
    properties.forEach(property => {
      property.phases?.forEach(phase => {
        // Only show phases that aren't completed
        if (phase.status === 'completed') return;
        
        if (phase.scheduledDate) {
          scheduled.push({ phase, property });
        } else {
          unscheduled.push({ phase, property });
        }
      });
    });
    
    return { scheduledJobs: scheduled, unscheduledJobs: unscheduled };
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
    setSelectedDate(new Date());
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
    
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentDate]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  // Schedule a phase for a date
  const schedulePhase = async (phase: Phase, property: PropertyWithRelations, date: Date) => {
    setIsScheduling(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // Update in Supabase
      const { error } = await supabase
        .from('phases')
        .update({ 
          scheduled_date: dateStr,
          status: 'scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', phase.id);
      
      if (error) throw error;
      
      // Update local cache
      await db.phases.update(phase.id, {
        scheduledDate: dateStr,
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
        lastModified: new Date()
      });
      
      // Refresh the list
      await refetch();
      
      setShowScheduleModal(false);
      setSelectedPhaseToSchedule(null);
      setSelectedDate(date);
    } catch (err) {
      console.error('Failed to schedule phase:', err);
      alert('Failed to schedule. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  // Open schedule modal for a specific date
  const openScheduleForDate = (date: Date) => {
    setSelectedDate(date);
    if (unscheduledJobs.length > 0) {
      setShowScheduleModal(true);
    }
  };

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-primary-600" />
          Schedule
        </h1>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Unscheduled Jobs Alert */}
      {unscheduledJobs.length > 0 && (
        <div 
          className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setShowScheduleModal(true)}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span className="text-amber-800 font-medium">
              {unscheduledJobs.length} job{unscheduledJobs.length !== 1 ? 's' : ''} need scheduling
            </span>
          </div>
          <Plus className="w-5 h-5 text-amber-600" />
        </div>
      )}

      {/* Month Navigation */}
      <Card className="mb-4">
        <div className="flex items-center justify-between p-3">
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
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="p-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-t border-gray-100">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="min-h-[60px] bg-gray-50" />;
            }

            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate && dateStr === selectedDate.toISOString().split('T')[0];
            const dayJobs = getJobsForDate(date);
            const jobCount = dayJobs.length;
            const isPast = date < new Date(today.setHours(0,0,0,0));

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(date)}
                onDoubleClick={() => !isPast && openScheduleForDate(date)}
                className={`min-h-[60px] p-1 border-t border-l border-gray-100 text-left transition-all relative
                  ${isSelected ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset z-10' : 'hover:bg-gray-50'}
                  ${isPast ? 'opacity-50' : ''}
                `}
              >
                <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mx-auto
                  ${isToday ? 'bg-primary-600 text-white' : 'text-gray-700'}
                `}>
                  {date.getDate()}
                </div>
                
                {jobCount > 0 && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {jobCount <= 3 ? (
                      Array.from({ length: jobCount }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                      ))
                    ) : (
                      <span className="text-xs text-primary-600 font-medium">{jobCount}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Date Panel */}
      {selectedDate && (
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}
              </p>
            </div>
            {selectedDate >= new Date(today.setHours(0,0,0,0)) && unscheduledJobs.length > 0 && (
              <Button 
                size="sm" 
                onClick={() => openScheduleForDate(selectedDate)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Job
              </Button>
            )}
          </div>

          {selectedJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No jobs scheduled</p>
              {selectedDate >= new Date(today.setHours(0,0,0,0)) && unscheduledJobs.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => openScheduleForDate(selectedDate)}
                >
                  Schedule a job
                </Button>
              )}
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
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(phase.status)}`}>
                      {formatPhaseType(phase.type)}
                    </span>
                    {phase.scheduledTimeWindow && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {phase.scheduledTimeWindow}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-gray-900 font-medium">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{property.street}</span>
                  </div>
                  
                  {property.customer && (
                    <p className="text-sm text-gray-600 ml-5 truncate">
                      {property.customer.firstName} {property.customer.lastName}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Quick Stats when no date selected */}
      {!selectedDate && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">This Week</h3>
          {(() => {
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const thisWeekJobs = scheduledJobs.filter(job => {
              const jobDate = new Date(job.phase.scheduledDate!);
              return jobDate >= weekStart && jobDate <= weekEnd;
            }).sort((a, b) => 
              new Date(a.phase.scheduledDate!).getTime() - new Date(b.phase.scheduledDate!).getTime()
            );

            if (thisWeekJobs.length === 0) {
              return <p className="text-gray-500 text-sm">No jobs scheduled this week</p>;
            }

            return (
              <div className="space-y-2">
                {thisWeekJobs.slice(0, 5).map(({ phase, property }) => (
                  <button
                    key={phase.id}
                    onClick={() => navigate(`/properties/${property.id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-10 text-center flex-shrink-0">
                      <div className="text-xs text-gray-500">
                        {new Date(phase.scheduledDate!).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold text-primary-600">
                        {new Date(phase.scheduledDate!).getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{property.street}</p>
                      <p className="text-sm text-gray-500 truncate">{formatPhaseType(phase.type)}</p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                {selectedDate ? (
                  <>Schedule for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                ) : (
                  <>Select Job to Schedule</>
                )}
              </h3>
              <button 
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedPhaseToSchedule(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {unscheduledJobs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">All jobs are scheduled!</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">
                    Tap a job to schedule it{selectedDate ? '' : ', then pick a date'}:
                  </p>
                  {unscheduledJobs.map(({ phase, property }) => (
                    <button
                      key={phase.id}
                      disabled={isScheduling}
                      onClick={() => {
                        if (selectedDate) {
                          schedulePhase(phase, property, selectedDate);
                        } else {
                          setSelectedPhaseToSchedule({ phase, property });
                          setShowScheduleModal(false);
                        }
                      }}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        isScheduling ? 'opacity-50 cursor-wait' :
                        selectedPhaseToSchedule?.phase.id === phase.id 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primary-700">
                          {formatPhaseType(phase.type)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(phase.status)}`}>
                          {phase.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{property.street}</p>
                      {property.customer && (
                        <p className="text-sm text-gray-500">
                          {property.customer.firstName} {property.customer.lastName}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating indicator when a phase is selected for scheduling */}
      {selectedPhaseToSchedule && !showScheduleModal && (
        <div className="fixed bottom-20 left-4 right-4 bg-primary-600 text-white p-3 rounded-lg shadow-lg flex items-center justify-between z-40">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedPhaseToSchedule.property.street}</p>
            <p className="text-sm text-primary-200">Tap a date to schedule</p>
          </div>
          <button 
            onClick={() => setSelectedPhaseToSchedule(null)}
            className="p-2 hover:bg-primary-700 rounded-lg ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
