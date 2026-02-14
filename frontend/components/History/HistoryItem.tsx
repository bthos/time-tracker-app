import React from 'react';
import { Activity, ManualEntry } from '../../types';
import { formatDuration, formatTime } from '../../utils/format';
import Button from '../Common/Button';
import { Edit2, Trash2, Play, Tag } from 'lucide-react';

export type HistoryItem = {
  id: string;
  type: 'activity' | 'manual';
  data: Activity | ManualEntry;
  startTime: Date;
  endTime: Date;
  duration: number;
};

interface HistoryItemProps {
  item: HistoryItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  getCategoryInfo: (categoryId?: number) => { name: string; color: string; icon: string };
  isActivityInProgress?: Set<number>;
  onEdit?: (entry: ManualEntry) => void;
  onDeleteActivity?: (id: number) => void;
  onDeleteManualEntry?: (id: number) => void;
  onCreateRule?: (activity: Activity) => void;
  isDeletingActivity?: boolean;
  isDeletingManualEntry?: boolean;
}

export const ActivityItem: React.FC<HistoryItemProps & { item: HistoryItem & { data: Activity } }> = ({
  item,
  isSelected,
  onSelect,
  getCategoryInfo,
  isActivityInProgress = new Set(),
  onCreateRule,
  onDeleteActivity,
  isDeletingActivity = false,
}) => {
  const activity = item.data;
  const category = getCategoryInfo(activity.category_id ?? undefined);
  const isActivityInProgressState = isActivityInProgress.has(activity.id!);
  
  return (
    <div
      className={`
        p-4 rounded-lg border transition-all cursor-pointer
        ${isSelected 
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      onClick={() => onSelect(isSelected ? '' : item.id)}
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
          {onCreateRule && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCreateRule(activity);
              }}
            >
              <Tag className="w-4 h-4 mr-1" />
              Create New Rule
            </Button>
          )}
          {onDeleteActivity && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDeleteActivity(activity.id!);
              }}
              disabled={isDeletingActivity || !activity.id}
            >
              {isDeletingActivity ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const ManualItem: React.FC<HistoryItemProps & { item: HistoryItem & { data: ManualEntry } }> = ({
  item,
  isSelected,
  onSelect,
  getCategoryInfo,
  onEdit,
  onDeleteManualEntry,
  isDeletingManualEntry = false,
}) => {
  const entry = item.data;
  const category = getCategoryInfo(entry.category_id ?? undefined);
  
  return (
    <div
      className={`
        p-4 rounded-lg border transition-all cursor-pointer
        ${isSelected 
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      onClick={() => onSelect(isSelected ? '' : item.id)}
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
            <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
              {entry.description || 'Manual Entry'}
            </h4>
            <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap flex-shrink-0">
              {formatDuration(item.duration)}
            </span>
          </div>
          
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
          {onEdit && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onEdit(entry);
              }}
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
          {onDeleteManualEntry && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDeleteManualEntry(entry.id);
              }}
              disabled={isDeletingManualEntry}
            >
              {isDeletingManualEntry ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

