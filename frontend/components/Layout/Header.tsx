import { Plus, Download, Brain, Pause, Play, Menu, Timer } from 'lucide-react';
import { useMemo } from 'react';
import { useStore } from '../../store';
import DateRangeSelector from './DateRangeSelector';
import { useStartThinkingMode, useStopThinkingMode, usePauseTracking, useResumeTracking } from '../../hooks/useTracker';
// Pomodoro functionality is now provided by plugins
import { formatTimerTime } from '../../utils/format';
import { handleApiError, showSuccess } from '../../utils/toast';
import { api } from '../../services/api';
import { exportData } from '../../utils/export';

interface HeaderProps {
  onAddEntry: () => void;
  onMenuClick?: () => void;
}

export default function Header({ onAddEntry, onMenuClick }: HeaderProps) {
  const isTrackingPaused = useStore((state) => state.isTrackingPaused);
  const setIsTrackingPaused = useStore((state) => state.setIsTrackingPaused);
  const isThinkingMode = useStore((state) => state.isThinkingMode);
  const setIsThinkingMode = useStore((state) => state.setIsThinkingMode);
  const getDateRange = useStore((state) => state.getDateRange);
  const categories = useStore((state) => state.categories);
  const startThinkingMode = useStartThinkingMode();
  const stopThinkingMode = useStopThinkingMode();
  const pauseTracking = usePauseTracking();
  const resumeTracking = useResumeTracking();
  
  // Pomodoro status is now provided by plugins
  const pomodoroStatus = { is_running: false, is_active: false, pomodoro_type: 'work' as const };
  const pausePomodoro = () => {};
  const resumePomodoro = () => {};

  // Find break category for pause functionality
  const breakCategoryId = useMemo(() => {
    const breakCategory = categories.find(c => 
      c.name.toLowerCase() === 'break' || 
      c.name.toLowerCase() === 'pause'
    );
    return breakCategory?.id;
  }, [categories]);

  const handleThinkingMode = async () => {
    try {
      if (isThinkingMode) {
        // Выключаем Thinking mode
        await stopThinkingMode.mutateAsync();
        setIsThinkingMode(false);
        // Thinking mode автоматически возобновляет трекинг при остановке
        setIsTrackingPaused(false);
        showSuccess('Thinking mode stopped');
      } else {
        // Если Pause активен, выключаем его перед включением Thinking mode
        if (isTrackingPaused) {
          try {
            await api.manualEntries.stopManualEntry();
          } catch (error) {
            // Игнорируем ошибку, если нет активной manual entry
          }
          await resumeTracking.mutateAsync();
          setIsTrackingPaused(false);
        }
        // Запускаем Thinking mode (он автоматически поставит трекинг на паузу)
        await startThinkingMode.mutateAsync();
        setIsThinkingMode(true);
        // НЕ устанавливаем isTrackingPaused = true, так как Thinking mode - это отдельное состояние
        showSuccess('Thinking mode started');
      }
    } catch (error) {
      handleApiError(error, `Failed to ${isThinkingMode ? 'stop' : 'start'} thinking mode`);
    }
  };

  const handlePauseResume = async () => {
    try {
      if (isTrackingPaused) {
        // Если Thinking mode активен, выключаем его
        if (isThinkingMode) {
          await stopThinkingMode.mutateAsync();
          setIsThinkingMode(false);
          setIsTrackingPaused(false);
          showSuccess('Thinking mode stopped, tracking resumed');
        } else {
          // Останавливаем break entry и возобновляем трекинг
          try {
            await api.manualEntries.stopManualEntry();
          } catch (error) {
            // Игнорируем ошибку, если нет активной manual entry
          }
          await resumeTracking.mutateAsync();
          setIsTrackingPaused(false);
          showSuccess('Tracking resumed');
        }
      } else {
        // Если Thinking mode активен, выключаем его перед включением Pause
        if (isThinkingMode) {
          await stopThinkingMode.mutateAsync();
          setIsThinkingMode(false);
        }
        // Создаем break entry для отслеживания времени паузы
        if (breakCategoryId) {
          await api.manualEntries.startManualEntry(breakCategoryId, 'Pause');
          await pauseTracking.mutateAsync();
          setIsTrackingPaused(true);
          showSuccess('Tracking paused');
        } else {
          handleApiError(new Error('Break category not found'), 'Failed to pause tracking');
        }
      }
    } catch (error) {
      handleApiError(error, 'Failed to pause/resume tracking');
    }
  };

  const handleExport = async () => {
    const dateRange = getDateRange();
    await exportData(dateRange);
  };

  return (
    <header className="h-14 sm:h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 sm:px-4 lg:px-6 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <DateRangeSelector />
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 flex-shrink-0">
        {/* Pomodoro Timer - Compact View - только для маленьких экранов */}
        {pomodoroStatus.is_running && (
          <button
            onClick={() => {
              if (pomodoroStatus.is_active) {
                pausePomodoro();
              } else {
                resumePomodoro();
              }
            }}
            className={`lg:hidden flex items-center gap-1 sm:gap-2 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-all duration-200 ${
              pomodoroStatus.pomodoro_type === 'work'
                ? 'bg-red-500 text-white shadow-md hover:bg-red-600 hover:shadow-lg'
                : 'bg-green-500 text-white shadow-md hover:bg-green-600 hover:shadow-lg'
            }`}
            title={`${pomodoroStatus.pomodoro_type === 'work' ? 'Work' : 'Break'} session - ${pomodoroStatus.is_active ? 'Click to pause' : 'Click to resume'}`}
          >
            <Timer className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="hidden md:inline font-medium text-sm sm:text-base font-mono">
              {formatTimerTime(pomodoroStatus.remaining_sec)}
            </span>
            <span className="md:hidden font-medium text-xs font-mono">
              {formatTimerTime(pomodoroStatus.remaining_sec)}
            </span>
            {pomodoroStatus.is_active && (
              <span className="ml-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></span>
            )}
          </button>
        )}

        {/* Thinking Mode Button */}
        <button
          onClick={handleThinkingMode}
          className={`flex items-center gap-1 sm:gap-2 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-all duration-200 ${
            isThinkingMode
              ? 'bg-[#00BCD4] text-white shadow-md hover:bg-[#00ACC1] hover:shadow-lg'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          title={isThinkingMode ? 'Stop thinking mode' : 'Start thinking mode'}
        >
          <Brain className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isThinkingMode ? 'animate-pulse' : ''}`} />
          <span className="hidden md:inline font-medium text-sm sm:text-base">Thinking</span>
          {isThinkingMode && (
            <span className="ml-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></span>
          )}
        </button>

        {/* Pause/Resume Button */}
        <button
          onClick={handlePauseResume}
          className={`flex items-center gap-1 sm:gap-2 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-all duration-200 ${
            isTrackingPaused && !isThinkingMode
              ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600 hover:shadow-lg'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          title={isTrackingPaused && !isThinkingMode ? 'Resume tracking' : 'Pause tracking'}
        >
          {!(isTrackingPaused && !isThinkingMode) ? (
            <>
              {/* Show Download icon on small screens, Pause icon on medium+ screens */}
              <Download className="md:hidden w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <Pause className="hidden md:block w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              {/* Show "Pause" text only on medium+ screens, like Resume */}
              <span className="hidden md:inline font-medium text-sm sm:text-base">Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden lg:inline text-sm sm:text-base">Resume</span>
            </>
          )}
        </button>

        {/* Export Button - hidden on small screens where Pause shows as Export */}
        <button
          onClick={handleExport}
          className="hidden md:flex items-center gap-1 sm:gap-2 whitespace-nowrap text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-colors duration-200"
          title="Export data"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="hidden lg:inline text-sm sm:text-base">Export</span>
        </button>

        {/* Add Entry Button */}
        <button
          onClick={onAddEntry}
          className="btn-primary flex items-center gap-1 sm:gap-2 whitespace-nowrap px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="hidden sm:inline">Add Entry</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </header>
  );
}
