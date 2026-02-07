import { useMemo } from 'react';
import { useDailyStats, useStatsForRange, useCategories, useTrackerStatus, useActivities, useProjects, useTasks } from '../../hooks';
import { useFocusSessions } from '../../hooks/useFocusSessions';
import { useStore } from '../../store';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import StatsOverview from './StatsOverview';
import CategoryChart from './CategoryChart';
import TopApps from './TopApps';
import Timeline from '../Timeline/Timeline';
import Insights from './Insights';
import DailyTrend from './DailyTrend';
import PomodoroWidget from './PomodoroWidget';
import GoalAlerts from '../Goals/GoalAlerts';
import BillableWidget from './BillableWidget';
import ProjectBreakdown from './ProjectBreakdown';
import TopWebsites from './TopWebsites';
import GoalProgressWidget from './GoalProgressWidget';
import ActiveProjectSelector from './ActiveProjectSelector';
import LoadingSpinner from '../Common/LoadingSpinner';
import { ErrorBoundary } from '../Common/ErrorBoundary';
import type { TimelineBlock, CategoryStats, AppStats, Category } from '../../types';

export default function Dashboard() {
  // Load data
  useCategories();
  useTrackerStatus();
  
  // Get date range and categories from store to ensure consistency with activities
  // Use selector to prevent re-renders from function reference changes
  const categories = useStore((state) => state.categories);
  const dateRangePreset = useStore((state) => state.dateRangePreset);
  const customStartTimestamp = useStore((state) => 
    state.dateRangePreset === 'custom' 
      ? (state.selectedDateRange.start instanceof Date 
          ? state.selectedDateRange.start.getTime() 
          : new Date(state.selectedDateRange.start).getTime())
      : null
  );
  const customEndTimestamp = useStore((state) => 
    state.dateRangePreset === 'custom'
      ? (state.selectedDateRange.end instanceof Date 
          ? state.selectedDateRange.end.getTime() 
          : new Date(state.selectedDateRange.end).getTime())
      : null
  );
  
  // Memoize date range calculation
  const dateRange = useMemo(() => {
    const now = new Date();
    
    switch (dateRangePreset) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case 'custom':
        return {
          start: customStartTimestamp !== null ? new Date(customStartTimestamp) : startOfDay(now),
          end: customEndTimestamp !== null ? new Date(customEndTimestamp) : endOfDay(now),
        };
      default:
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
    }
  }, [dateRangePreset, customStartTimestamp, customEndTimestamp]);
  
  // Ensure dates are Date objects (defensive check)
  const start = dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start);
  const end = dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end);
  
  // Use the start date of the selected range for daily stats
  // If range spans multiple days, we'll compute stats from activities instead
  const statsDate = start;
  const isSingleDay = start.toDateString() === end.toDateString();
  
  const { data: stats, isLoading: statsLoading, error: statsError } = useDailyStats(isSingleDay ? statsDate : undefined);
  const { data: rangeStats, isLoading: rangeStatsLoading, error: rangeStatsError } = useStatsForRange(dateRange);
  const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useActivities();

  // Get projects and tasks for timeline enrichment (must be before early returns)
  const { projects } = useProjects(false);
  const { tasks: allTasks } = useTasks(undefined, false);
  
  // Get focus sessions for pomodoro timeline
  const { sessions: focusSessions } = useFocusSessions(dateRange);

  // Build displayStats from API only (single-day: get_daily_stats; multi-day: get_stats)
  const displayStats = useMemo((): { total_duration_sec: number; productive_duration_sec: number; categories: CategoryStats[]; top_apps: AppStats[] } => {
    const empty: { total_duration_sec: number; productive_duration_sec: number; categories: CategoryStats[]; top_apps: AppStats[] } = {
      total_duration_sec: 0,
      productive_duration_sec: 0,
      categories: [],
      top_apps: [],
    };

    if (isSingleDay && stats && typeof stats === 'object') {
      // Backend get_daily_stats returns total_seconds, productive_seconds, category_stats, app_stats
      const total = (stats as { total_seconds?: number; total_duration_sec?: number }).total_seconds ?? (stats as { total_duration_sec?: number }).total_duration_sec ?? 0;
      const productive = (stats as { productive_seconds?: number; productive_duration_sec?: number }).productive_seconds ?? (stats as { productive_duration_sec?: number }).productive_duration_sec ?? 0;
      const catStats = (stats as { category_stats?: CategoryStats[]; categories?: CategoryStats[] }).category_stats ?? (stats as { categories?: CategoryStats[] }).categories ?? [];
      const appList = (stats as { app_stats?: AppStats[]; top_apps?: AppStats[] }).app_stats ?? (stats as { top_apps?: AppStats[] }).top_apps ?? [];
      return {
        total_duration_sec: total,
        productive_duration_sec: productive,
        categories: catStats,
        top_apps: appList,
      };
    }

    if (!isSingleDay && rangeStats) {
      const total = rangeStats.total_seconds;
      const productive = rangeStats.productive_seconds;
      const minimalCategory = (id: number, name: string, color: string): Category =>
        ({ id, name, color, icon: '', is_productive: null, is_billable: null, hourly_rate: null, sort_order: 0 });
      const categories: CategoryStats[] = rangeStats.category_breakdown.map((row) => ({
        category: minimalCategory(row.category_id, row.category_name, row.color),
        duration_sec: row.seconds,
        percentage: total > 0 ? Math.round((row.seconds / total) * 100) : 0,
      }));
      const top_apps: AppStats[] = rangeStats.app_breakdown.map((row) => ({
        app_name: row.app_name,
        duration_sec: row.seconds,
        category: null,
      }));
      return { total_duration_sec: total, productive_duration_sec: productive, categories, top_apps };
    }

    return empty;
  }, [isSingleDay, stats, rangeStats]);

  const hasStatsData = isSingleDay ? stats : rangeStats;
  // Show warning if one query failed but we can still display partial data
  const showPartialDataWarning = (isSingleDay && statsError && !stats) || (!isSingleDay && rangeStatsError && !rangeStats) || (activitiesError && !activities);

  // Calculate uncategorized apps count
  const uncategorizedAppsCount = useMemo(() => {
    if (!activities || activities.length === 0) return 0;
    const activeActivities = activities.filter(a => !a.is_idle);
    const appsWithoutCategory = new Set(
      activeActivities
        .filter(a => !a.category_id)
        .map(a => a.app_name)
    );
    return appsWithoutCategory.size;
  }, [activities]);

  // Build timeline from activities with project/task/billable info
  const timelineBlocks: TimelineBlock[] = useMemo(() => {
    if (!activities || !categories) return [];
    
    return activities.map((activity) => {
      // Find category for this activity
      const category = activity.category_id 
        ? categories.find(c => c.id === activity.category_id) || null
        : null;
      
      // Find project for this activity
      const project = activity.project_id
        ? projects.find(p => p.id === activity.project_id) || null
        : null;
      
      // Find task for this activity
      const task = activity.task_id
        ? allTasks.find(t => t.id === activity.task_id) || null
        : null;
      
      // Calculate billable status
      // TODO: Refactor billable logic - currently project billable takes precedence over category billable.
      // Consider:
      // - Should this be OR logic (billable if either project OR category is billable)?
      // - Should this be AND logic (billable only if both are billable)?
      // - Should project always override category, or should category override project in some cases?
      // - Should we create a utility function to calculate billable status consistently across the app?
      // See also: database.rs get_billable_hours and get_billable_revenue methods
      let is_billable = false;
      if (project?.is_billable) {
        is_billable = true;
      } else if (category?.is_billable === true) {
        is_billable = true;
      }
      
      return {
        start: activity.started_at * 1000, // Convert to milliseconds
        end: (activity.started_at + activity.duration_sec) * 1000,
        app_name: activity.app_name,
        domain: activity.domain,
        category: category,
        project: project,
        task: task,
        is_idle: activity.is_idle,
        is_manual: false,
        is_billable: is_billable,
      };
    });
  }, [activities, categories, projects, allTasks]);


  // Show loading only if we're loading stats (for current range type) and activities, and have no data yet
  const statsLoadingForRange = isSingleDay ? statsLoading : rangeStatsLoading;
  const isLoading = (statsLoadingForRange || activitiesLoading) && !hasStatsData && !activities;
  
  // Show error only if stats and activities both fail AND we have no data
  const hasFatalError = (isSingleDay ? statsError : rangeStatsError) && activitiesError && !hasStatsData && !activities;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  const statsOrRangeError = isSingleDay ? statsError : rangeStatsError;
  if (hasFatalError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">Failed to load dashboard data</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Stats: {String(statsOrRangeError)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Activities: {String(activitiesError)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
      {/* Show warning if partial data */}
      {showPartialDataWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-900 dark:text-yellow-200 font-medium">
            {(isSingleDay ? statsError && !stats : rangeStatsError && !rangeStats) && 'Unable to load statistics. '}
            {activitiesError && !activities && 'Unable to load activities. '}
            Showing available data.
          </p>
        </div>
      )}
      
      {/* Stats Overview and Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
        <StatsOverview
          totalDuration={displayStats.total_duration_sec}
          productiveDuration={displayStats.productive_duration_sec}
        />
        {(displayStats.total_duration_sec > 0 || (activities && activities.length > 0)) && (
          <div className="lg:col-span-2 h-full">
            <Insights
              totalDuration={displayStats.total_duration_sec}
              productiveDuration={displayStats.productive_duration_sec}
              categories={displayStats.categories || []}
              topApps={displayStats.top_apps || []}
              uncategorizedCount={uncategorizedAppsCount}
            />
          </div>
        )}
      </div>

      {/* Active Project Selector and Pomodoro Widget Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ErrorBoundary>
          <ActiveProjectSelector />
        </ErrorBoundary>
        <PomodoroWidget />
      </div>

      {/* Goal Alerts */}
      <ErrorBoundary>
        <GoalAlerts maxAlerts={3} />
      </ErrorBoundary>

      {/* Billable Time and Goal Progress Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ErrorBoundary>
          <BillableWidget />
        </ErrorBoundary>
        <ErrorBoundary>
          <GoalProgressWidget />
        </ErrorBoundary>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart categories={displayStats.categories || []} />
        <TopApps apps={displayStats.top_apps || []} totalDuration={displayStats.total_duration_sec} />
      </div>

      {/* Project Breakdown and Top Websites Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ErrorBoundary>
          <ProjectBreakdown />
        </ErrorBoundary>
        <ErrorBoundary>
          <TopWebsites />
        </ErrorBoundary>
      </div>

      {/* Daily Trend - Show for multi-day ranges */}
      <ErrorBoundary>
        <DailyTrend />
      </ErrorBoundary>

      {/* Timeline */}
      {timelineBlocks.length > 0 && <Timeline blocks={timelineBlocks} focusSessions={focusSessions} />}
      {timelineBlocks.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No activity data available for the selected period
        </div>
      )}
    </div>
  );
}
