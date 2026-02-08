import { useMemo } from 'react';
import { useDailyStats, useStatsForRange, useCategories, useTrackerStatus, useActivities } from '../../hooks';
import { useStore } from '../../store';
import { usePluginFrontend } from '../../hooks/usePluginFrontend';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import StatsOverview from './StatsOverview';
import CategoryChart from './CategoryChart';
import TopApps from './TopApps';
import Timeline from '../Timeline/Timeline';
import Insights from './Insights';
import DailyTrend from './DailyTrend';
import TopWebsites from './TopWebsites';
import LoadingSpinner from '../Common/LoadingSpinner';
import { ErrorBoundary } from '../Common/ErrorBoundary';
import type { TimelineBlock, CategoryStats, AppStats, Category } from '../../types';
import type { PluginDashboardWidget } from '../../types/pluginFrontend';

export default function Dashboard() {
  // Load data
  useCategories();
  useTrackerStatus();
  const { dashboardWidgets: pluginWidgets } = usePluginFrontend();
  
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

  // Build timeline from activities with category info
  const timelineBlocks: TimelineBlock[] = useMemo(() => {
    if (!activities || !categories) return [];
    
    return activities.map((activity) => {
      // Find category for this activity
      const category = activity.category_id 
        ? categories.find(c => c.id === activity.category_id) || null
        : null;
      
      // Calculate billable status from category
      let is_billable = false;
      if (category?.is_billable === true) {
        is_billable = true;
      }
      
      return {
        start: activity.started_at * 1000, // Convert to milliseconds
        end: (activity.started_at + activity.duration_sec) * 1000,
        app_name: activity.app_name,
        domain: activity.domain,
        category: category,
        project: null, // Projects are now handled by plugins
        task: null, // Tasks are now handled by plugins
        is_idle: activity.is_idle,
        is_manual: false,
        is_billable: is_billable,
      };
    });
  }, [activities, categories]);


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


      {/* Plugin Dashboard Widgets */}
      {pluginWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {pluginWidgets.map((widget: PluginDashboardWidget) => {
            const WidgetComponent = widget.component;
            const colSpan = widget.gridColSpan || 1;
            return (
              <ErrorBoundary key={widget.id}>
                <div className={colSpan === 2 ? 'lg:col-span-2' : colSpan === 3 ? 'lg:col-span-3' : ''}>
                  <WidgetComponent />
                </div>
              </ErrorBoundary>
            );
          })}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart categories={displayStats.categories || []} />
        <TopApps apps={displayStats.top_apps || []} totalDuration={displayStats.total_duration_sec} />
      </div>

      {/* Top Websites Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ErrorBoundary>
          <TopWebsites />
        </ErrorBoundary>
      </div>

      {/* Daily Trend - Show for multi-day ranges */}
      <ErrorBoundary>
        <DailyTrend />
      </ErrorBoundary>

      {/* Timeline */}
      {timelineBlocks.length > 0 && <Timeline blocks={timelineBlocks} focusSessions={[]} />}
      {timelineBlocks.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No activity data available for the selected period
        </div>
      )}
    </div>
  );
}
