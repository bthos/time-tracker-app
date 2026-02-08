import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, ManualEntry, FocusSession } from '../../types';
import { formatDuration, formatTime, formatDate } from '../../utils/format';
import Button from '../Common/Button';
import { useActivities, useManualEntries, useDeleteActivity, useDeleteManualEntry, useDeleteFocusSession } from '../../hooks';
// Focus Sessions, Projects, and Tasks are now provided by plugins
import { useTrackerStatus } from '../../hooks/useTracker';
import { SkeletonLoader } from '../Common/SkeletonLoader';
import { Edit2, Trash2, Inbox, Calendar, Briefcase, Coffee, CheckCircle2, XCircle, Clock, Play, Filter, Tag } from 'lucide-react';

interface HistoryProps {
  activities?: Activity[];
  manualEntries?: ManualEntry[];
  onEditEntry?: (entry: ManualEntry) => void;
  onNavigateToSettings?: () => void;
}

type HistoryItem = {
  id: string;
  type: 'activity' | 'manual' | 'focus';
  data: Activity | ManualEntry | FocusSession;
  startTime: Date;
  endTime: Date;
  duration: number;
  focusSession?: FocusSession; // Метаданные focus session для activity
};

const History: React.FC<HistoryProps> = ({ 
  activities: propsActivities, 
  manualEntries: propsManualEntries, 
  onEditEntry,
  onNavigateToSettings
}) => {
  const { categories, setPendingRuleData, setSettingsActiveTab } = useStore();
  const [filter, setFilter] = useState<'all' | 'activities' | 'manual' | 'focus'>('all');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const virtualActivityStartTimeRef = useRef<number | null>(null);
  const previousAppRef = useRef<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingProgrammaticallyRef = useRef<boolean>(false);
  const programmaticScrollTargetRef = useRef<string | null>(null);
  const scrollEndTimeRef = useRef<number>(0);
  const lastActiveDateUpdateRef = useRef<number>(0);
  const lastActiveDateRef = useRef<string | null>(null);
  const activeDateUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use hooks if props not provided
  const { data: hookActivities, isLoading: activitiesLoading } = useActivities();
  const { data: hookManualEntries, isLoading: manualEntriesLoading } = useManualEntries();
  const deleteActivityMutation = useDeleteActivity();
  const deleteManualEntryMutation = useDeleteManualEntry();
  const deleteFocusSessionMutation = useDeleteFocusSession();
  
  // Focus Sessions, Projects, and Tasks are now provided by plugins
  const focusSessions: FocusSession[] = [];
  const focusSessionsLoading = false;
  const refetchFocusSessions = () => {};
  const projects: any[] = [];
  const allTasks: any[] = [];
  const { data: trackerStatus } = useTrackerStatus();
  
  // Update current time every second for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const activities = useMemo(() => propsActivities || hookActivities || [], [propsActivities, hookActivities]);
  const manualEntries = useMemo(() => propsManualEntries || hookManualEntries || [], [propsManualEntries, hookManualEntries]);
  
  // Combine and sort all items (safe to compute even during loading)
  const sortedActivities = useMemo(() => 
    activities.length > 0 ? [...activities].sort((a, b) => a.started_at - b.started_at) : [],
    [activities]
  );
  
  // Создать карту focus sessions для быстрого поиска по activity
  const focusSessionMap = useMemo(() => {
    const map = new Map<number, FocusSession>();
    
    // Фильтруем только завершенные сессии с валидным временем окончания
    const sortedSessions = [...focusSessions]
      .filter(session => 
        session.completed && 
        session.duration_sec > 0 && 
        session.ended_at !== null &&
        session.ended_at > session.started_at
      )
      .sort((a, b) => a.started_at - b.started_at);
    
    sortedActivities.forEach(activity => {
      const activityStart = activity.started_at;
      const activityEnd = activity.started_at + activity.duration_sec;
      
      // Найти focus session, которая содержит большую часть activity
      // Activity должна быть преимущественно внутри focus session
      const matchingSession = sortedSessions.find(session => {
        const sessionStart = session.started_at;
        const sessionEnd = session.ended_at!; // Мы уже проверили, что ended_at не null
        
        // Проверяем перекрытие
        const overlapStart = Math.max(activityStart, sessionStart);
        const overlapEnd = Math.min(activityEnd, sessionEnd);
        
        if (overlapStart >= overlapEnd) {
          return false; // Нет перекрытия
        }
        
        const overlapDuration = overlapEnd - overlapStart;
        const activityDuration = activityEnd - activityStart;
        
        // Activity должна быть хотя бы на 50% внутри focus session
        // Или activity должна полностью находиться внутри focus session
        const overlapPercentage = overlapDuration / activityDuration;
        const isActivityInsideSession = activityStart >= sessionStart && activityEnd <= sessionEnd;
        
        return overlapPercentage >= 0.5 || isActivityInsideSession;
      });
      
      if (matchingSession) {
        map.set(activity.id!, matchingSession);
      }
    });
    
    return map;
  }, [focusSessions, sortedActivities]);
  
  // Determine if an activity is in progress
  const isActivityInProgress = useMemo(() => {
    if (sortedActivities.length === 0 || !trackerStatus?.isTracking) {
      return new Set<number>();
    }
    
    const inProgressSet = new Set<number>();
    const now = Math.floor(currentTime / 1000);
    
    // Check if we need a virtual current activity (current app differs from last DB entry)
    const lastActivity = sortedActivities[sortedActivities.length - 1];
    const needsVirtualCurrent = trackerStatus?.isTracking && 
                                 !trackerStatus.isPaused && 
                                 trackerStatus.currentApp && 
                                 lastActivity && 
                                 trackerStatus.currentApp !== lastActivity.app_name &&
                                 (now - lastActivity.started_at) > 5;
    
    if (needsVirtualCurrent) {
      // Virtual activity will be added, so mark it as in progress (id = -1)
      inProgressSet.add(-1);
    } else if (lastActivity && trackerStatus && !trackerStatus.isPaused) {
      // No virtual activity needed - check if last activity is still active
      // Last activity is considered "in progress" if:
      // 1. It matches current app from tracker status
      const matchesCurrentApp = trackerStatus.currentApp && 
        trackerStatus.currentApp === lastActivity.app_name;
      
      // Only mark as in progress if it matches current app (not just if recent)
      if (matchesCurrentApp) {
        inProgressSet.add(lastActivity.id!);
      }
    }
    
    return inProgressSet;
  }, [sortedActivities, trackerStatus, currentTime]);
  
  const historyItems: HistoryItem[] = useMemo((): HistoryItem[] => {
    if (activitiesLoading || manualEntriesLoading || focusSessionsLoading) {
      return [];
    }
    
    // Check if we need to add a virtual current activity
    const now = Math.floor(currentTime / 1000);
    const lastActivity = sortedActivities.length > 0 ? sortedActivities[sortedActivities.length - 1] : null;
    const needsVirtualCurrent = trackerStatus?.isTracking && 
                                 !trackerStatus.isPaused && 
                                 trackerStatus.currentApp && 
                                 lastActivity && 
                                 trackerStatus.currentApp !== lastActivity.app_name &&
                                 (now - lastActivity.started_at) > 5; // Only if last activity is older than 5 seconds
    
    // Reset virtual activity start time if conditions changed
    const currentApp = trackerStatus?.currentApp || null;
    const appChanged = currentApp !== previousAppRef.current;
    
    if (!needsVirtualCurrent) {
      // Tracking stopped, paused, or no longer need virtual activity
      virtualActivityStartTimeRef.current = null;
      previousAppRef.current = currentApp;
    } else if (appChanged && virtualActivityStartTimeRef.current !== null) {
      // App changed while virtual activity exists - reset it and immediately set new start time
      virtualActivityStartTimeRef.current = now - 5; // Start 5 seconds ago to account for polling delay
      previousAppRef.current = currentApp;
    } else if (needsVirtualCurrent && virtualActivityStartTimeRef.current === null) {
      // Set start time when virtual activity is first created
      virtualActivityStartTimeRef.current = now - 5; // Start 5 seconds ago to account for polling delay
      previousAppRef.current = currentApp;
    }
    
    const activitiesToProcess = needsVirtualCurrent && lastActivity && virtualActivityStartTimeRef.current !== null ? [
      ...sortedActivities,
      // Virtual current activity
      {
        id: -1, // Virtual ID
        app_name: trackerStatus!.currentApp!,
        window_title: null,
        domain: null,
        category_id: null,
        project_id: lastActivity.project_id,
        task_id: lastActivity.task_id,
        started_at: virtualActivityStartTimeRef.current, // Use fixed start time, not recalculated
        duration_sec: 5,
        is_idle: false,
      } as Activity
    ] : sortedActivities;
    
    return [
    // Все activities с привязкой focus session как метаданных
    ...activitiesToProcess.map((a, index): HistoryItem => {
      const startTime = new Date(a.started_at * 1000);
      const isInProgress = isActivityInProgress.has(a.id!);
      
      // Calculate end time: use next activity's start time if available and close enough,
      // otherwise use stored duration or current time for in progress activities
      let endTime: Date;
      let duration: number;
      
      if (isInProgress) {
        // In progress: use current time
        const now = Math.floor(currentTime / 1000);
        endTime = new Date(currentTime);
        duration = now - a.started_at;
      } else if (index < sortedActivities.length - 1) {
        const nextActivity = sortedActivities[index + 1];
        const timeToNext = nextActivity.started_at - a.started_at;
        
        // If next activity starts within 5 minutes and is different app/window, use it as end time
        if (timeToNext > 0 && timeToNext <= 300 && 
            (nextActivity.app_name !== a.app_name || nextActivity.window_title !== a.window_title)) {
          endTime = new Date(nextActivity.started_at * 1000);
          duration = timeToNext;
        } else {
          // Use stored duration
          duration = Math.max(a.duration_sec, 5); // Ensure minimum 5 seconds
          endTime = new Date((a.started_at + duration) * 1000);
        }
      } else {
        // Last activity: use stored duration, or current time if it's the virtual current activity
        if (a.id === -1 && isInProgress) {
          // Virtual current activity: use current time
          const now = Math.floor(currentTime / 1000);
          endTime = new Date(currentTime);
          duration = now - a.started_at;
        } else {
          duration = Math.max(a.duration_sec, 5); // Ensure minimum 5 seconds
          endTime = new Date((a.started_at + duration) * 1000);
        }
      }
      
      return {
        id: `activity-${a.id}`,
        type: 'activity',
        data: a,
        startTime,
        endTime,
        duration,
        focusSession: a.id !== -1 ? focusSessionMap.get(a.id!) : undefined, // Метаданные focus session (skip for virtual)
      };
    }),
    
    ...manualEntries.map((m): HistoryItem => ({
      id: `manual-${m.id}`,
      type: 'manual',
      data: m,
      startTime: new Date(m.started_at * 1000),
      endTime: new Date(m.ended_at * 1000),
      duration: m.ended_at - m.started_at,
    })),
    
    // Focus sessions как отдельные записи (включая все состояния)
    ...focusSessions
      .map((session): HistoryItem => {
        const startTime = new Date(session.started_at * 1000);
        let endTime: Date;
        let duration: number;
        
        if (session.ended_at === null) {
          // In progress: use current time
          const now = Math.floor(currentTime / 1000);
          endTime = new Date(currentTime);
          duration = now - session.started_at;
        } else {
          // Completed or interrupted: use stored values
          endTime = new Date(session.ended_at * 1000);
          duration = session.duration_sec || 0;
        }
        
        return {
          id: `focus-${session.id}`,
          type: 'focus',
          data: session,
          startTime,
          endTime,
          duration,
        };
      }),
    ]
      .filter(item => {
        if (filter === 'all') return true;
        if (filter === 'activities') return item.type === 'activity';
        if (filter === 'manual') return item.type === 'manual';
        if (filter === 'focus') return item.type === 'focus';
        return true;
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [
    activitiesLoading,
    manualEntriesLoading,
    focusSessionsLoading,
    sortedActivities,
    manualEntries,
    focusSessions,
    trackerStatus,
    currentTime,
    focusSessionMap,
    isActivityInProgress,
    filter,
  ]);
  
  // Group by date
  const groupedItems = useMemo<Record<string, HistoryItem[]>>(() => {
    const grouped: Record<string, HistoryItem[]> = {};
    historyItems.forEach(item => {
      const dateKey = formatDate(item.startTime);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });
    return grouped;
  }, [historyItems]);
  
  // Get sorted date keys (newest first)
  const dateKeys = Object.keys(groupedItems).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });
  
  // Function to scroll to a specific date
  const scrollToDate = (date: string) => {
    const headerElement = dateHeadersRef.current.get(date);
    if (headerElement && containerRef.current) {
      // Set flag to block IntersectionObserver updates during programmatic scroll
      isScrollingProgrammaticallyRef.current = true;
      programmaticScrollTargetRef.current = date;
      
      // Immediately set active date when clicking
      setActiveDate(date);
      
      const container = containerRef.current;
      // Find the parent div that contains the date section
      const dateSection = headerElement.parentElement as HTMLElement;
      const targetElement = dateSection || headerElement;
      
      // Get current scroll position
      const currentScrollTop = container.scrollTop;
      
      // Get positions using getBoundingClientRect (works even if element is already visible)
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      
      // Calculate the scroll position needed to bring target to top of container
      const scrollPosition = currentScrollTop + (targetRect.top - containerRect.top);
      
      container.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
      
      // Re-enable IntersectionObserver after scroll animation completes
      // Smooth scroll typically takes ~500-800ms, so we use 1200ms to be safe
      setTimeout(() => {
        // Ensure active date is set to the intended one
        setActiveDate(date);
        scrollEndTimeRef.current = Date.now();
        // Re-enable IntersectionObserver after a delay, but keep target date protected
        setTimeout(() => {
          isScrollingProgrammaticallyRef.current = false;
          // Clear target after additional delay to allow normal IntersectionObserver behavior
          setTimeout(() => {
            programmaticScrollTargetRef.current = null;
          }, 500);
        }, 300);
      }, 1200);
    }
  };
  
  // Set initial active date
  useEffect(() => {
    if (dateKeys.length > 0 && !activeDate && containerRef.current) {
      // Set the first (newest) date as active initially
      const initialDate = dateKeys[0];
      setActiveDate(initialDate);
      lastActiveDateRef.current = initialDate;
      lastActiveDateUpdateRef.current = Date.now();
    }
  }, [dateKeys, activeDate]);

  // IntersectionObserver to track visible dates (must be before conditional return)
  useEffect(() => {
    if (dateKeys.length === 0 || !containerRef.current) return;

    let observer: IntersectionObserver | null = null;

    // Wait for refs to be set
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      // Clean up old refs that are no longer in dateKeys
      const currentDateKeys = new Set(dateKeys);
      dateHeadersRef.current.forEach((_element, date) => {
        if (!currentDateKeys.has(date)) {
          dateHeadersRef.current.delete(date);
        }
      });

      const observerOptions = {
        root: containerRef.current,
        rootMargin: '-10px 0px -80% 0px', // Active date when header is near the top
        threshold: [0, 0.1, 0.5, 1]
      };

      observer = new IntersectionObserver((entries) => {
        // Skip updates during programmatic scrolling
        if (isScrollingProgrammaticallyRef.current) {
          return;
        }
        
        // Protect target date for a period after programmatic scroll ends
        const timeSinceScrollEnd = Date.now() - scrollEndTimeRef.current;
        const targetDate = programmaticScrollTargetRef.current;
        if (targetDate && timeSinceScrollEnd < 800) {
          // Don't switch away from target date for 800ms after scroll ends
          return;
        }
        
        // Find all intersecting date headers with their positions
        const visibleDates = entries
          .map(entry => {
            const date = entry.target.getAttribute('data-date');
            if (!date) return null;
            
            const rect = entry.boundingClientRect;
            const containerRect = containerRef.current!.getBoundingClientRect();
            const relativeTop = rect.top - containerRect.top;
            
            return { 
              date, 
              top: relativeTop,
              intersectionRatio: entry.intersectionRatio,
              isIntersecting: entry.isIntersecting
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .filter(item => item.isIntersecting && item.top >= -50 && item.top <= 100); // Within reasonable range
        
        if (visibleDates.length > 0) {
          // Sort by top position (closest to top wins)
          visibleDates.sort((a, b) => {
            // Prefer dates that are closer to the top
            const aDistance = Math.abs(a.top);
            const bDistance = Math.abs(b.top);
            if (Math.abs(aDistance - bDistance) < 10) {
              // If very close, prefer the one with higher intersection ratio
              return b.intersectionRatio - a.intersectionRatio;
            }
            return aDistance - bDistance;
          });
          
          const newActiveDate = visibleDates[0].date;
          const newActiveDateTop = visibleDates[0].top;
          const currentActiveDate = lastActiveDateRef.current || activeDate;
          
          // Don't switch if we're still protecting a target date and the new date is different
          if (targetDate && newActiveDate !== targetDate && timeSinceScrollEnd < 1500) {
            return;
          }
          
          // Apply hysteresis: only switch if the new date is significantly closer to top
          // or if current date is no longer visible
          if (currentActiveDate && newActiveDate !== currentActiveDate) {
            const currentDateEntry = visibleDates.find(v => v.date === currentActiveDate);
            
            // If current date is still visible, check if new date is significantly better
            if (currentDateEntry) {
              const currentTop = currentDateEntry.top;
              const improvement = Math.abs(currentTop) - Math.abs(newActiveDateTop);
              
              // Only switch if new date is at least 30px closer to top (hysteresis threshold)
              if (improvement < 30) {
                return;
              }
            }
          }
          
          // Debounce: clear any pending update
          if (activeDateUpdateTimeoutRef.current) {
            clearTimeout(activeDateUpdateTimeoutRef.current);
          }
          
          // Throttle updates: minimum 150ms between updates
          const timeSinceLastUpdate = Date.now() - lastActiveDateUpdateRef.current;
          const delay = Math.max(0, 150 - timeSinceLastUpdate);
          
          activeDateUpdateTimeoutRef.current = setTimeout(() => {
            lastActiveDateRef.current = newActiveDate;
            lastActiveDateUpdateRef.current = Date.now();
            setActiveDate(newActiveDate);
          }, delay);
        }
      }, observerOptions);

      // Observe all date headers
      dateHeadersRef.current.forEach((element) => {
        if (element) {
          observer!.observe(element);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (activeDateUpdateTimeoutRef.current) {
        clearTimeout(activeDateUpdateTimeoutRef.current);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [dateKeys, groupedItems, activeDate]);
  
  if (activitiesLoading || manualEntriesLoading || focusSessionsLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <SkeletonLoader lines={2} />
          </div>
        ))}
      </div>
    );
  }
  
  const getCategoryInfo = (categoryId?: number) => {
    if (!categoryId) return { name: 'Uncategorized', color: '#9E9E9E', icon: '❓' };
    const category = categories.find(c => c.id === categoryId);
    return category || { name: 'Uncategorized', color: '#9E9E9E', icon: '❓' };
  };
  
  const handleDeleteActivity = async (id: number | undefined) => {
    if (!id) {
      const { showError } = await import('../../utils/toast');
      showError('Failed to determine record ID');
      return;
    }
    
    if (window.confirm('Delete this record?')) {
      try {
        await deleteActivityMutation.mutateAsync(id);
        setSelectedItem(null); // Close the selected item after deletion
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Record deleted successfully');
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to delete record');
      }
    }
  };
  
  const handleCreateRuleFromActivity = (activity: Activity) => {
    // Определить тип Rule и pattern на основе Activity
    let ruleType: 'app_name' | 'window_title' | 'domain';
    let pattern: string;

    if (activity.domain && activity.domain.trim()) {
      ruleType = 'domain';
      pattern = activity.domain.trim();
    } else if (activity.window_title && activity.window_title.trim()) {
      ruleType = 'window_title';
      pattern = activity.window_title.trim();
    } else {
      ruleType = 'app_name';
      pattern = activity.app_name.trim();
    }

    // Использовать текущую категорию activity если есть, иначе undefined
    const categoryId = activity.category_id || undefined;

    // Сохранить данные для предзаполнения формы
    setPendingRuleData({
      rule_type: ruleType,
      pattern: pattern,
      category_id: categoryId,
    });
    
    // Открыть Settings на вкладке Rules
    setSettingsActiveTab('rules');
    
    // Перейти в Settings
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const handleDeleteManualEntry = async (id: number) => {
    if (window.confirm('Delete this record?')) {
      try {
        await deleteManualEntryMutation.mutateAsync(id);
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Record deleted successfully');
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to delete record');
      }
    }
  };
  
  const handleDeleteFocusSession = async (id: number) => {
    if (window.confirm('Delete this record?')) {
      try {
        await deleteFocusSessionMutation.mutateAsync(id);
        setSelectedItem(null); // Close the selected item after deletion
        refetchFocusSessions(); // Refetch focus sessions to update the list
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Record deleted successfully');
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to delete record');
      }
    }
  };
  
  const renderActivityItem = (item: HistoryItem) => {
    const activity = item.data as Activity;
    const focusSession = item.focusSession; // Получить метаданные focus session
    const category = getCategoryInfo(activity.category_id ?? undefined);
    const isSelected = selectedItem === item.id;
    const isActivityInProgressState = isActivityInProgress.has(activity.id!);
    
    // Получить информацию о focus session
    const isWork = focusSession?.pomodoro_type === 'work';
    const project = focusSession?.project_id ? projects.find(p => p.id === focusSession.project_id) : null;
    const task = focusSession?.task_id ? allTasks.find(t => t.id === focusSession.task_id) : null;
    
    // Определить состояние focus session
    let sessionStatus: 'in_progress' | 'completed' | 'interrupted' | null = null;
    if (focusSession) {
      if (focusSession.ended_at === null) {
        sessionStatus = 'in_progress';
      } else if (focusSession.completed) {
        sessionStatus = 'completed';
      } else {
        sessionStatus = 'interrupted';
      }
    }
    
    return (
      <div
        key={item.id}
        className={`
          p-4 rounded-lg border transition-all cursor-pointer
          ${isSelected 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
        onClick={() => setSelectedItem(isSelected ? null : item.id)}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg flex-shrink-0"
            style={{ backgroundColor: category.color + '20' }}
          >
            {category.icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
                  {activity.app_name}
                </h4>
                {activity.is_idle && (
                  <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 whitespace-nowrap flex-shrink-0">
                    Idle
                  </span>
                )}
                {isActivityInProgressState && (
                  <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Active
                  </span>
                )}
                {focusSession && (
                  <span className={`px-1.5 sm:px-2 py-0.5 text-xs rounded whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
                    isWork
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {sessionStatus === 'in_progress' && <Clock className="w-3 h-3" />}
                    {sessionStatus === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                    {sessionStatus === 'interrupted' && <XCircle className="w-3 h-3" />}
                    {isWork ? 'Work Session' : 'Break Session'}
                  </span>
                )}
              </div>
              <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                {formatDuration(item.duration)}
              </span>
            </div>
            
            {activity.window_title && (
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                {activity.window_title}
              </p>
            )}
            
            {(project || task) && (
              <div className="text-xs sm:text-sm text-primary-600 dark:text-primary-400 mt-1 truncate">
                {project && <span>📁 {project.name}</span>}
                {project && task && <span> • </span>}
                {task && <span>✓ {task.name}</span>}
              </div>
            )}
            
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
              <span className="whitespace-nowrap">{formatTime(item.startTime.getTime())} - {formatTime(item.endTime.getTime())}</span>
              <span 
                className="px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: category.color + '20', color: category.color }}
              >
                {category.name}
              </span>
            </div>
          </div>
        </div>
        
        {isSelected && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleCreateRuleFromActivity(activity);
              }}
            >
              <Tag className="w-4 h-4 mr-1" />
              Create New Rule
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDeleteActivity(activity.id);
              }}
              disabled={deleteActivityMutation.isPending || !activity.id}
            >
              {deleteActivityMutation.isPending ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  const renderManualItem = (item: HistoryItem) => {
    const entry = item.data as ManualEntry;
    const isSelected = selectedItem === item.id;
    const category = getCategoryInfo(entry.category_id ?? undefined);
    
    return (
      <div
        key={item.id}
        className={`
          p-4 rounded-lg border transition-all cursor-pointer
          ${isSelected 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
        onClick={() => setSelectedItem(isSelected ? null : item.id)}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg flex-shrink-0"
            style={{ backgroundColor: category.color + '20' }}
          >
            {category.icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                  {category.name}
                </h4>
                <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 whitespace-nowrap flex-shrink-0">
                  Manual Entry
                </span>
              </div>
              <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                {formatDuration(item.duration)}
              </span>
            </div>
            
            {entry.description && (
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                {entry.description}
              </p>
            )}
            
            {entry.project && (
              <p className="text-xs sm:text-sm text-primary-600 dark:text-primary-400 mt-1 truncate">
                📁 {entry.project}
              </p>
            )}
            
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <span className="whitespace-nowrap">{formatTime(item.startTime.getTime())} - {formatTime(item.endTime.getTime())}</span>
              <span 
                className="px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: category.color + '20', color: category.color }}
              >
                {category.name}
              </span>
            </div>
          </div>
        </div>
        
        {isSelected && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEditEntry?.(entry);
              }}
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteManualEntry(entry.id!);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  const renderFocusSessionItem = (item: HistoryItem) => {
    const session = item.data as FocusSession;
    const isSelected = selectedItem === item.id;
    const isWork = session.pomodoro_type === 'work';
    const project = session.project_id ? projects.find(p => p.id === session.project_id) : null;
    const task = session.task_id ? allTasks.find(t => t.id === session.task_id) : null;
    
    // Определить состояние focus session
    let sessionStatus: 'in_progress' | 'completed' | 'interrupted';
    if (session.ended_at === null) {
      sessionStatus = 'in_progress';
    } else if (session.completed) {
      sessionStatus = 'completed';
    } else {
      sessionStatus = 'interrupted';
    }
    
    return (
      <div
        key={item.id}
        className={`
          p-4 rounded-lg border transition-all cursor-pointer
          ${isSelected 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
        onClick={() => setSelectedItem(isSelected ? null : item.id)}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div 
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isWork
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            }`}
          >
            {isWork ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <Coffee className="w-5 h-5" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                  {isWork ? 'Work Session' : 'Break Session'}
                </h4>
                {sessionStatus === 'in_progress' && (
                  <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    In Progress
                  </span>
                )}
                {sessionStatus === 'completed' && (
                  <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                )}
                {sessionStatus === 'interrupted' && (
                  <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Interrupted
                  </span>
                )}
              </div>
              <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
                {formatDuration(item.duration)}
              </span>
            </div>
            
            {(project || task) && (
              <div className="text-xs sm:text-sm text-primary-600 dark:text-primary-400 mt-1 truncate">
                {project && <span>📁 {project.name}</span>}
                {project && task && <span> • </span>}
                {task && <span>✓ {task.name}</span>}
              </div>
            )}
            
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
              <span className="whitespace-nowrap">{formatTime(item.startTime.getTime())} - {formatTime(item.endTime.getTime())}</span>
            </div>
          </div>
        </div>
        
        {isSelected && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDeleteFocusSession(session.id);
              }}
              disabled={deleteFocusSessionMutation.isPending || !session.id}
            >
              {deleteFocusSessionMutation.isPending ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-2 sm:space-y-3 overflow-x-hidden">
      {/* Combined Filters and Date Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-row items-center gap-3 sm:gap-4 flex-wrap">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="activities">Auto</option>
              <option value="focus">Focus</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          
          {/* Date Quick Navigation */}
          {dateKeys.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 flex-shrink-0">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Quick Dates:</span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 min-w-0 flex-1">
                {dateKeys.map((date) => {
                  const dateObj = new Date(date);
                  const isActive = activeDate === date;
                  const dayNumber = dateObj.getDate();
                  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  
                  return (
                    <button
                      key={date}
                      onClick={() => scrollToDate(date)}
                      className={`
                        flex flex-col items-center justify-center px-2 py-1 rounded-lg text-xs whitespace-nowrap flex-shrink-0 min-w-[35px] border border-gray-300 dark:border-gray-600
                        ${isActive
                          ? 'bg-primary-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }
                      `}
                      title={date}
                    >
                      <div className="font-semibold text-[10px] opacity-75 leading-tight">{dayName}</div>
                      <div className="font-bold text-base leading-tight">{dayNumber}</div>
                      <div className="font-medium text-[10px] opacity-75 leading-tight">{month}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* History List */}
      <div ref={containerRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto overflow-x-hidden -mx-4 sm:-mx-6 lg:-mx-8">
          {Object.entries(groupedItems).length === 0 ? (
            <div className="text-center py-12 px-4 sm:px-6 lg:px-8">
              <Inbox className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <p className="text-gray-600 dark:text-gray-400">
                No records for the selected period
              </p>
            </div>
          ) : (
            <div className="space-y-6 px-4 sm:px-6 lg:px-8">
              {Object.entries(groupedItems).map(([date, items]) => (
                <div key={date}>
                  <div 
                    ref={(el) => {
                      if (el) {
                        dateHeadersRef.current.set(date, el);
                      } else {
                        dateHeadersRef.current.delete(date);
                      }
                    }}
                    data-date={date}
                    className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm mb-3 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
                    <h3 className={`
                      text-sm sm:text-base font-semibold 
                      text-gray-900 dark:text-gray-100 
                      py-2
                      min-h-[2.5rem]
                      transition-all duration-200
                    `}>
                      <span className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-gray-400 dark:text-gray-500 text-xs font-normal whitespace-nowrap">
                          {new Date(items[0].startTime).toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>
                        <span className="whitespace-nowrap">{date}</span>
                      </span>
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => {
                      if (item.type === 'activity') return renderActivityItem(item);
                      if (item.type === 'manual') return renderManualItem(item);
                      if (item.type === 'focus') return renderFocusSessionItem(item);
                      return null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default History;
