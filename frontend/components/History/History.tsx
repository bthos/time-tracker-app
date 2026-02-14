import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, ManualEntry } from '../../types';
import { useActivities, useManualEntries, useDeleteActivity, useDeleteManualEntry } from '../../hooks';
import { SkeletonLoader } from '../Common/SkeletonLoader';
import { HistoryFilters } from './HistoryFilters';
import { HistoryList } from './HistoryList';
import { useHistoryItems } from './useHistoryItems';
import { useHistoryScroll } from './useHistoryScroll';

interface HistoryProps {
  activities?: Activity[];
  manualEntries?: ManualEntry[];
  onEditEntry?: (entry: ManualEntry) => void;
  onNavigateToSettings?: () => void;
}

const History: React.FC<HistoryProps> = ({ 
  activities: propsActivities, 
  manualEntries: propsManualEntries, 
  onEditEntry,
  onNavigateToSettings
}) => {
  const { categories, setPendingRuleData, setSettingsActiveTab } = useStore();
  const [filter, setFilter] = useState<'all' | 'activities' | 'manual' | 'focus'>('all');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Use hooks if props not provided
  const { data: hookActivities, isLoading: activitiesLoading } = useActivities();
  const { data: hookManualEntries, isLoading: manualEntriesLoading } = useManualEntries();
  const deleteActivityMutation = useDeleteActivity();
  const deleteManualEntryMutation = useDeleteManualEntry();
  
  
  // Update current time every second for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const activities = useMemo(() => propsActivities || hookActivities || [], [propsActivities, hookActivities]);
  const manualEntries = useMemo(() => propsManualEntries || hookManualEntries || [], [propsManualEntries, hookManualEntries]);
  
  // Use custom hooks for history items and scroll management
  const { groupedItems, isActivityInProgress } = useHistoryItems({
    activities,
    manualEntries,
    filter,
    currentTime,
  });
  
  const dateKeys = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedItems]);
  
  const { activeDate, scrollToDate } = useHistoryScroll({
    dateKeys,
    containerRef,
    dateHeadersRef,
  });
  
  if (activitiesLoading || manualEntriesLoading) {
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
        setSelectedItem(null);
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Record deleted successfully');
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to delete record');
      }
    }
  };
  
  const handleCreateRuleFromActivity = (activity: Activity) => {
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

    const categoryId = activity.category_id || undefined;

    setPendingRuleData({
      rule_type: ruleType,
      pattern: pattern,
      category_id: categoryId,
    });
    
    setSettingsActiveTab('rules');
    
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const handleDeleteManualEntry = async (id: number) => {
    if (window.confirm('Delete this record?')) {
      try {
        await deleteManualEntryMutation.mutateAsync(id);
        setSelectedItem(null);
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Record deleted successfully');
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to delete record');
      }
    }
  };
  
  return (
    <div className="space-y-2 sm:space-y-3 overflow-x-hidden">
      <HistoryFilters
        filter={filter}
        onFilterChange={setFilter}
        dateKeys={dateKeys}
        activeDate={activeDate}
        onDateClick={scrollToDate}
      />
      
      <HistoryList
        groupedItems={groupedItems}
        selectedItem={selectedItem}
        onSelectItem={setSelectedItem}
        getCategoryInfo={getCategoryInfo}
        isActivityInProgress={isActivityInProgress}
        onEditEntry={onEditEntry}
        onDeleteActivity={handleDeleteActivity}
        onDeleteManualEntry={handleDeleteManualEntry}
        onCreateRule={handleCreateRuleFromActivity}
        isDeletingActivity={deleteActivityMutation.isPending}
        isDeletingManualEntry={deleteManualEntryMutation.isPending}
        dateHeadersRef={dateHeadersRef}
        containerRef={containerRef}
      />
    </div>
  );
};

export default History;
