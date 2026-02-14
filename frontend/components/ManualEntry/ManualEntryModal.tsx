import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { format, subHours } from 'date-fns';
import { useCreateManualEntry, useUpdateManualEntry } from '../../hooks';
import { useStore } from '../../store';
import { usePinnedCategories } from '../../hooks/useCategories';
import type { ManualEntry, Category } from '../../types';
import Button from '../Common/Button';

interface ManualEntryModalProps {
  editEntry?: ManualEntry | null;
  onSubmit?: (entry: {
    description: string;
    categoryId: number | null;
    startedAt: Date;
    endedAt: Date;
  }) => Promise<void>;
  onClose: () => void;
}

export default function ManualEntryModal({ editEntry, onClose }: ManualEntryModalProps) {
  const { categories } = useStore();
  const { data: pinnedCategories = [] } = usePinnedCategories();
  const createEntry = useCreateManualEntry();
  const updateEntry = useUpdateManualEntry();

  const now = new Date();
  const oneHourAgo = subHours(now, 1);

  const [description, setDescription] = useState(editEntry?.description || '');
  const [categoryId, setCategoryId] = useState<number | null>(editEntry?.category_id ?? null);
  const [startDate, setStartDate] = useState(
    editEntry 
      ? format(new Date(editEntry.started_at * 1000), "yyyy-MM-dd'T'HH:mm")
      : format(oneHourAgo, "yyyy-MM-dd'T'HH:mm")
  );
  const [endDate, setEndDate] = useState(
    editEntry
      ? format(new Date(editEntry.ended_at * 1000), "yyyy-MM-dd'T'HH:mm")
      : format(now, "yyyy-MM-dd'T'HH:mm")
  );

  // Set default category if not set and pinned categories available
  useEffect(() => {
    if (!categoryId && pinnedCategories.length > 0 && !editEntry) {
      setCategoryId(pinnedCategories[0].id);
    }
  }, [categoryId, pinnedCategories, editEntry]);

  useEffect(() => {
    if (editEntry) {
      setDescription(editEntry.description || '');
      setCategoryId(editEntry.category_id ?? null);
      setStartDate(format(new Date(editEntry.started_at * 1000), "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(new Date(editEntry.ended_at * 1000), "yyyy-MM-dd'T'HH:mm"));
    }
  }, [editEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startedAt = new Date(startDate).getTime();
    const endedAt = new Date(endDate).getTime();

    if (endedAt <= startedAt) {
      alert('End time must be after start time');
      return;
    }

    try {
      if (editEntry) {
        await updateEntry.mutateAsync({
          id: editEntry.id,
          description: description || null,
          category_id: categoryId,
          started_at: Math.floor(startedAt / 1000),
          ended_at: Math.floor(endedAt / 1000),
        });
      } else {
        await createEntry.mutateAsync({
          description: description || null,
          category_id: categoryId,
          started_at: Math.floor(startedAt / 1000),
          ended_at: Math.floor(endedAt / 1000),
        });
      }
      
      onClose();
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, editEntry ? 'Failed to update entry' : 'Failed to create entry');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {editEntry ? 'Edit Entry' : 'Add Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category Selection (Pinned Categories) */}
          {pinnedCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Type
              </label>
              <div className="flex flex-wrap gap-2">
                {pinnedCategories.map((category: Category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      categoryId === category.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{
                      borderColor: categoryId === category.id ? category.color : undefined,
                      backgroundColor: categoryId === category.id ? category.color + '20' : undefined,
                    }}
                  >
                    <span className="mr-2">{category.icon}</span>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="select"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>


          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What were you working on?"
              className="input resize-none h-20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              variant="success"
              className="flex-1"
              disabled={createEntry.isPending || updateEntry.isPending}
            >
              {(createEntry.isPending || updateEntry.isPending) ? (
                'Saving...'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
