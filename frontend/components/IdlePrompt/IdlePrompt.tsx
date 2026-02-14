import React, { useState } from 'react';
import { formatDuration } from '../../utils/format';
import Button from '../Common/Button';
import { usePinnedCategories } from '../../hooks/useCategories';
import { Settings } from 'lucide-react';
import type { Category } from '../../types';

interface IdlePromptProps {
  durationMinutes: number;
  onSubmit: (categoryId: number, comment?: string) => Promise<void>;
  onSkip: () => void;
  onNavigateToSettings?: () => void;
}

const IdlePrompt: React.FC<IdlePromptProps> = ({ durationMinutes, onSubmit, onSkip, onNavigateToSettings }) => {
  const { data: pinnedCategories = [] } = usePinnedCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  
  const idleDuration = durationMinutes;
  
  const handleSave = async () => {
    if (selectedCategoryId) {
      await onSubmit(selectedCategoryId, description || undefined);
    }
  };
  
  const handleSkip = () => {
    onSkip();
  };
  
  const handleSettingsClick = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
      onSkip(); // Close the popup when navigating to settings
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            You're back!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Away for: <span className="font-medium text-primary-700 dark:text-primary-300">{formatDuration(idleDuration)}</span>
          </p>
        </div>
        
        {/* Activity Options */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            What were you doing?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {pinnedCategories.map((category: Category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                  ${selectedCategoryId === category.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
                style={{
                  borderColor: selectedCategoryId === category.id ? category.color : undefined,
                  backgroundColor: selectedCategoryId === category.id ? category.color + '20' : undefined,
                }}
              >
                <span className="text-2xl mb-1">{category.icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {category.name}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Description Input */}
        {selectedCategoryId && (
          <div className="mb-6 animate-fade-in">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comment (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What were you thinking about, who did you call..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            disabled={!selectedCategoryId}
          >
            Save
          </Button>
        </div>
        
        {/* Settings link */}
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSettingsClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg 
                       text-sm font-medium text-gray-600 dark:text-gray-400 
                       hover:text-primary-600 dark:hover:text-primary-400 
                       hover:bg-gray-50 dark:hover:bg-gray-700/50 
                       transition-all duration-200 group"
          >
            <Settings className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span className="text-center">
              Change when this popup appears
              <span className="block text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                (Idle Prompt Threshold in Settings)
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdlePrompt;
