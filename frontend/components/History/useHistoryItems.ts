import { useMemo, useRef } from 'react';
import { Activity, ManualEntry } from '../../types';
import { formatDate } from '../../utils/format';
import { HistoryItem } from './HistoryItem';
import { useTrackerStatus } from '../../hooks/useTracker';

interface UseHistoryItemsOptions {
  activities: Activity[];
  manualEntries: ManualEntry[];
  filter: 'all' | 'activities' | 'manual' | 'focus';
  currentTime: number;
}

export function useHistoryItems({
  activities,
  manualEntries,
  filter,
  currentTime,
}: UseHistoryItemsOptions) {
  const virtualActivityStartTimeRef = useRef<number | null>(null);
  const previousAppRef = useRef<string | null>(null);
  const { data: trackerStatus } = useTrackerStatus();

  // Sort activities
  const sortedActivities = useMemo(() => 
    activities.length > 0 ? [...activities].sort((a, b) => a.started_at - b.started_at) : [],
    [activities]
  );


  // Determine if an activity is in progress
  const isActivityInProgress = useMemo(() => {
    if (sortedActivities.length === 0 || !trackerStatus?.isTracking) {
      return new Set<number>();
    }
    
    const inProgressSet = new Set<number>();
    const now = Math.floor(currentTime / 1000);
    
    const lastActivity = sortedActivities[sortedActivities.length - 1];
    const needsVirtualCurrent = trackerStatus?.isTracking && 
                                 !trackerStatus.isPaused && 
                                 trackerStatus.currentApp && 
                                 lastActivity && 
                                 trackerStatus.currentApp !== lastActivity.app_name &&
                                 (now - lastActivity.started_at - lastActivity.duration_sec) > 10;
    
    if (needsVirtualCurrent && virtualActivityStartTimeRef.current === null) {
      virtualActivityStartTimeRef.current = now - 5;
      previousAppRef.current = trackerStatus.currentApp;
    }
    
    const activitiesToProcess = needsVirtualCurrent && lastActivity && virtualActivityStartTimeRef.current !== null ? [
      ...sortedActivities,
      {
        id: -1,
        app_name: trackerStatus!.currentApp!,
        window_title: null,
        domain: null,
        category_id: null,
        started_at: virtualActivityStartTimeRef.current,
        duration_sec: 5,
        is_idle: false,
      } as Activity
    ] : sortedActivities;
    
    activitiesToProcess.forEach((activity, index) => {
      if (activity.id === -1) {
        inProgressSet.add(-1);
      } else if (index === sortedActivities.length - 1 && trackerStatus?.isTracking && !trackerStatus.isPaused) {
        const now = Math.floor(currentTime / 1000);
        const timeSinceStart = now - activity.started_at;
        if (timeSinceStart > activity.duration_sec + 5) {
          inProgressSet.add(activity.id!);
        }
      }
    });
    
    return inProgressSet;
  }, [sortedActivities, trackerStatus, currentTime]);

  // Combine and sort all items
  const historyItems = useMemo(() => {
    const now = Math.floor(currentTime / 1000);
    const lastActivity = sortedActivities[sortedActivities.length - 1];
    const needsVirtualCurrent = trackerStatus?.isTracking && 
                                 !trackerStatus.isPaused && 
                                 trackerStatus.currentApp && 
                                 lastActivity && 
                                 trackerStatus.currentApp !== lastActivity.app_name &&
                                 (now - lastActivity.started_at - lastActivity.duration_sec) > 10;
    
    const activitiesToProcess = needsVirtualCurrent && lastActivity && virtualActivityStartTimeRef.current !== null ? [
      ...sortedActivities,
      {
        id: -1,
        app_name: trackerStatus!.currentApp!,
        window_title: null,
        domain: null,
        category_id: null,
        started_at: virtualActivityStartTimeRef.current,
        duration_sec: 5,
        is_idle: false,
      } as Activity
    ] : sortedActivities;

    return [
      ...activitiesToProcess.map((a, index): HistoryItem => {
        const startTime = new Date(a.started_at * 1000);
        const isInProgress = isActivityInProgress.has(a.id!);
        
        let endTime: Date;
        let duration: number;
        
        if (isInProgress) {
          const now = Math.floor(currentTime / 1000);
          endTime = new Date(currentTime);
          duration = now - a.started_at;
        } else if (index < sortedActivities.length - 1) {
          const nextActivity = sortedActivities[index + 1];
          const timeToNext = nextActivity.started_at - a.started_at;
          
          if (timeToNext > 0 && timeToNext <= 300 && 
              (nextActivity.app_name !== a.app_name || nextActivity.window_title !== a.window_title)) {
            endTime = new Date(nextActivity.started_at * 1000);
            duration = timeToNext;
          } else {
            duration = Math.max(a.duration_sec, 5);
            endTime = new Date((a.started_at + duration) * 1000);
          }
        } else {
          if (a.id === -1 && isInProgress) {
            const now = Math.floor(currentTime / 1000);
            endTime = new Date(currentTime);
            duration = now - a.started_at;
          } else {
            duration = Math.max(a.duration_sec, 5);
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
      
    ]
      .filter(item => {
        if (filter === 'all') return true;
        if (filter === 'activities') return item.type === 'activity';
        if (filter === 'manual') return item.type === 'manual';
        return true;
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [
    sortedActivities,
    manualEntries,
    trackerStatus,
    currentTime,
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

  return {
    historyItems,
    groupedItems,
    isActivityInProgress,
  };
}
