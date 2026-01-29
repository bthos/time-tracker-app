import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, Coffee, X } from 'lucide-react';
import Button from '../Common/Button';
import { useStore } from '../../store';

interface PomodoroTransitionModalProps {
  isOpen: boolean;
  type: 'work' | 'break';
  breakType?: 'short' | 'long';
  onConfirm: () => void;
  onCancel: () => void;
}

const PomodoroTransitionModal: React.FC<PomodoroTransitionModalProps> = ({
  isOpen,
  type,
  breakType,
  onConfirm,
  onCancel,
}) => {
  const { settings } = useStore();
  // TODO: Проверить автопереход между сессиями Work и Break
  // TODO 6: Проверить настройку pomodoro_auto_transition_delay_seconds - возможно она равна 0 или не установлена
  const autoConfirmDelay = settings.pomodoro_auto_transition_delay_seconds ?? 15;
  const [countdown, setCountdown] = useState(autoConfirmDelay);
  const hasConfirmedRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep onConfirm ref up to date
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(autoConfirmDelay);
      hasConfirmedRef.current = false;
      // Clear timer when modal closes
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // If auto-transition is disabled (delay = 0), don't start countdown
    if (autoConfirmDelay === 0) {
      return;
    }

    hasConfirmedRef.current = false;
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Prevent multiple calls
          if (!hasConfirmedRef.current) {
            hasConfirmedRef.current = true;
            onConfirmRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, autoConfirmDelay]);

  // Handle cancel - stop timer and prevent auto-confirm
  const handleCancel = () => {
    hasConfirmedRef.current = true; // Prevent auto-confirm
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onCancel();
  };

  if (!isOpen) return null;

  // type represents the COMPLETED session
  const completedIsWork = type === 'work';
  const isLongBreak = breakType === 'long';
  
  // Next session is the opposite of completed session
  const nextIsWork = !completedIsWork;
  
  // Get durations from settings or use defaults
  const getWorkDuration = () => {
    return settings.pomodoro_work_duration_seconds ?? 
           (settings.pomodoro_work_duration_minutes ?? 25) * 60;
  };

  const getShortBreakDuration = () => {
    return settings.pomodoro_short_break_seconds ?? 
           (settings.pomodoro_short_break_minutes ?? 5) * 60;
  };

  const getLongBreakDuration = () => {
    return settings.pomodoro_long_break_seconds ?? 
           (settings.pomodoro_long_break_minutes ?? 15) * 60;
  };

  const nextSessionDuration = nextIsWork 
    ? getWorkDuration() 
    : isLongBreak 
      ? getLongBreakDuration() 
      : getShortBreakDuration();
  const nextSessionLabel = nextIsWork ? 'Work Session' : isLongBreak ? 'Long Break' : 'Short Break';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              completedIsWork
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            }`}>
              {completedIsWork ? (
                <Briefcase className="w-6 h-6" />
              ) : (
                <Coffee className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {completedIsWork ? 'Work Session Completed!' : 'Break Completed!'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {completedIsWork 
                  ? 'Great job! Time for a break.' 
                  : 'Ready to get back to work?'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              Start {nextSessionLabel}?
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              Duration: {Math.floor(nextSessionDuration / 60)} minutes
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onConfirm}
            variant="primary"
            className="flex-1"
            style={{
              backgroundColor: nextIsWork 
                ? '#EF4444' 
                : isLongBreak 
                  ? '#10B981' 
                  : '#10B981'
            }}
          >
            Start {nextSessionLabel} {autoConfirmDelay > 0 && countdown > 0 && `(${countdown})`}
          </Button>
          <Button
            onClick={handleCancel}
            variant="secondary"
            className="flex-1"
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PomodoroTransitionModal;
