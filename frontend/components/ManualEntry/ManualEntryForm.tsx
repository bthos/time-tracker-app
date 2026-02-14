import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { ManualEntry as ManualEntryType, Category } from '../../types';
import { formatDuration } from '../../utils/format';
import Button from '../Common/Button';
import { manualEntriesApi } from '../../services/api/manualEntries';
import { usePinnedCategories } from '../../hooks/useCategories';
import { X, Save } from 'lucide-react';

interface ManualEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: ManualEntryType | null;
}

const ManualEntryForm: React.FC<ManualEntryFormProps> = ({ isOpen, onClose, editEntry }) => {
  const { categories } = useStore();
  const { data: pinnedCategories = [] } = usePinnedCategories();
  
  const [description, setDescription] = useState(editEntry?.description || '');
  const [categoryId, setCategoryId] = useState<number | undefined>(editEntry?.category_id ?? undefined);
  
  // Set default category if not set and pinned categories available
  useEffect(() => {
    if (!categoryId && pinnedCategories.length > 0 && !editEntry) {
      setCategoryId(pinnedCategories[0].id);
    }
  }, [categoryId, pinnedCategories, editEntry]);
  const [startDate, setStartDate] = useState(
    editEntry?.started_at 
      ? new Date(editEntry.started_at * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(
    editEntry?.started_at
      ? new Date(editEntry.started_at * 1000).toTimeString().slice(0, 5)
      : new Date().toTimeString().slice(0, 5)
  );
  const [endTime, setEndTime] = useState(
    editEntry?.ended_at
      ? new Date(editEntry.ended_at * 1000).toTimeString().slice(0, 5)
      : new Date(Date.now() + 3600000).toTimeString().slice(0, 5)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const startedAt = new Date(`${startDate}T${startTime}`);
    const endedAt = new Date(`${startDate}T${endTime}`);
    
    if (endedAt <= startedAt) {
      endedAt.setDate(endedAt.getDate() + 1);
    }
    
    setIsSubmitting(true);
    
    try {
      const entry = {
        description: description || null,
        category_id: categoryId ?? null,
        started_at: Math.floor(startedAt.getTime() / 1000),
        ended_at: Math.floor(endedAt.getTime() / 1000),
        // Плагины должны обновлять эти поля через call_db_method после создания/обновления записи
      };
      
      if (editEntry?.id) {
        await manualEntriesApi.updateManualEntry({
          id: editEntry.id,
          ...entry,
        });
      } else {
        await manualEntriesApi.createManualEntry(entry);
      }
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Manual entry saved successfully');
      onClose();
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to save manual entry');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  const duration = (() => {
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${startDate}T${endTime}`);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  })();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editEntry ? 'Edit Entry' : 'Add Activity'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category Selection (Pinned Categories) */}
          {pinnedCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Activity Type
              </label>
              <div className="flex flex-wrap gap-2">
                {pinnedCategories.map((category: Category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                      ${categoryId === category.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                    style={{
                      borderColor: categoryId === category.id ? category.color : undefined,
                      backgroundColor: categoryId === category.id ? category.color + '20' : undefined,
                    }}
                  >
                    <span>{category.icon}</span>
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What were you doing..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Time Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Duration Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Duration: </span>
            <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {formatDuration(duration)}
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryForm;
