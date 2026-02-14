import React from 'react';

interface HistoryDateHeaderProps {
  date: string;
  itemsCount: number;
  innerRef?: (el: HTMLDivElement | null) => void;
}

export const HistoryDateHeader: React.FC<HistoryDateHeaderProps> = ({
  date,
  innerRef,
}) => {
  const dateObj = new Date(date);
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div 
      ref={innerRef}
      data-date={date}
      className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm mb-3 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
    >
      <h3 className={`
        text-sm sm:text-base font-semibold 
        text-gray-900 dark:text-gray-100 
        py-2
        min-h-[2.5rem]
        transition-all duration-200
      `}>
        <span className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-gray-400 dark:text-gray-500 text-xs font-normal whitespace-nowrap">
            {weekday}
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>
          <span className="whitespace-nowrap">{date}</span>
        </span>
      </h3>
    </div>
  );
};
