import React, { useState, useMemo } from 'react';
import { useActivities } from '../../hooks/useActivities';
import { useCategories } from '../../hooks/useCategories';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { formatDuration } from '../../utils/format';
import { exportData } from '../../utils/export';
import { SkeletonCard, SkeletonLoader } from '../Common/SkeletonLoader';
import { Filter, X } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { Activity, Category } from '../../types';
type TimePeriod = 'today' | 'week' | 'month';

export const Reports: React.FC = () => {
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  
  // Compute dateRange from period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [period]);
  
  const { data: activities = [], isLoading: activitiesLoading } = useActivities();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  
  const isLoading = activitiesLoading || categoriesLoading;
  
  // Get unique domains from activities
  const domains = useMemo(() => {
    const domainSet = new Set<string>();
    activities.forEach(a => {
      if (a.domain) {
        domainSet.add(a.domain);
      }
    });
    return Array.from(domainSet).sort();
  }, [activities]);
  
  // Filter activities based on selected filters
  const filteredActivities = useMemo(() => {
    return activities.filter((activity: Activity) => {
      if (selectedDomain !== null && activity.domain !== selectedDomain) {
        return false;
      }
      return true;
    });
  }, [activities, selectedDomain]);
  
  const totalTime = useMemo(() => {
    return filteredActivities.reduce((sum: number, a: Activity) => sum + a.duration_sec, 0);
  }, [filteredActivities]);
  
  const productiveTime = useMemo(() => {
    return filteredActivities
      .filter((a: Activity) => a.category_id && categories.find((c: Category) => c.id === a.category_id)?.is_productive)
      .reduce((sum: number, a: Activity) => sum + a.duration_sec, 0);
  }, [filteredActivities, categories]);

  // Calculate stats by category
  const categoryStats = useMemo(() => {
    const stats: Record<number, number> = {};
    filteredActivities.forEach((activity) => {
      const catId = activity.category_id || -1; // Default to "Uncategorized"
      stats[catId] = (stats[catId] || 0) + activity.duration_sec;
    });

    return Object.entries(stats)
      .map(([id, duration]) => {
        const category = categories.find(c => c.id === Number(id));
        return {
          id: Number(id),
          name: category?.name || 'Unknown',
          duration,
          color: category?.color || '#9E9E9E',
          icon: category?.icon || '❓',
        };
      })
      .sort((a, b) => b.duration - a.duration);
  }, [filteredActivities, categories]);

  // Calculate daily breakdown for trend chart
  const dailyStats = useMemo(() => {
    const days: Record<string, { productive: number; unproductive: number; total: number }> = {};
    const today = new Date();
    const daysCount = period === 'week' ? 7 : period === 'month' ? 30 : 1;

    // Initialize days
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      days[key] = { productive: 0, unproductive: 0, total: 0 };
    }

    filteredActivities.forEach((activity) => {
      const date = new Date(activity.started_at * 1000).toISOString().split('T')[0];
      if (days[date]) {
        const category = categories.find(c => c.id === activity.category_id);
        const duration = activity.duration_sec;
        days[date].total += duration;
        if (category?.is_productive === true) {
          days[date].productive += duration;
        } else if (category?.is_productive === false) {
          days[date].unproductive += duration;
        }
      }
    });

    return Object.entries(days).map(([date, stats]) => ({
      date,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      productive: Math.round(stats.productive / 3600 * 10) / 10,
      unproductive: Math.round(stats.unproductive / 3600 * 10) / 10,
      total: Math.round(stats.total / 3600 * 10) / 10,
    }));
  }, [filteredActivities, period, categories]);

  // Top apps
  const topApps = useMemo(() => {
    const apps: Record<string, number> = {};
    filteredActivities.forEach((activity) => {
      apps[activity.app_name] = (apps[activity.app_name] || 0) + activity.duration_sec;
    });

    return Object.entries(apps)
      .map(([name, duration]) => ({ name, duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }, [filteredActivities]);

  // Top websites
  const topWebsites = useMemo(() => {
    const websites: Record<string, number> = {};
    filteredActivities.forEach((activity) => {
      if (activity.domain) {
        websites[activity.domain] = (websites[activity.domain] || 0) + activity.duration_sec;
      }
    });

    return Object.entries(websites)
      .map(([domain, duration]) => {
        const displayDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        return { domain, displayDomain, duration };
      })
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }, [filteredActivities]);


  const handleExport = async () => {
    await exportData(dateRange, {
      defaultFileName: `timetracker-report-${period}`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <SkeletonLoader lines={1} height="h-8" className="w-32" />
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700" />
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700" />
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Reports
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            {(['today', 'week', 'month'] as TimePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm transition-colors ${
                  period === p
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {p === 'today' && 'Day'}
                {p === 'week' && 'Week'}
                {p === 'month' && 'Month'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Domain Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Domain
            </label>
            <select
              value={selectedDomain ?? ''}
              onChange={(e) => setSelectedDomain(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Domains</option>
              {domains.map((domain) => {
                const displayDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                return (
                  <option key={domain} value={domain}>
                    {displayDomain}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Clear Filters Button */}
          {selectedDomain !== null && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedDomain(null);
                }}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Time</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(totalTime)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Productive</div>
          <div className="text-2xl font-bold text-green-600">
            {formatDuration(productiveTime)}
          </div>
        </div>
      </div>


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            By Category
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats}
                  dataKey="duration"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {categoryStats.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatDuration(value)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {categoryStats.slice(0, 6).map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }} />
                <span className="text-gray-600 dark:text-gray-400 truncate">{cat.name}</span>
                <span className="text-gray-900 dark:text-white ml-auto">{formatDuration(cat.duration)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Apps Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Apps
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topApps} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 3600000)}h`} />
                <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatDuration(value)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="duration" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Websites Chart */}
      {topWebsites.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Top Websites
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topWebsites} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 3600000)}h`} />
                <YAxis type="category" dataKey="displayDomain" width={115} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatDuration(value)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="duration" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Trend Chart */}
      {period !== 'today' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(v) => `${v}h`} />
                <Tooltip
                  formatter={(value: number) => `${value}h`}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="productive"
                  name="Productive"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={{ fill: '#22C55E' }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ fill: '#6366F1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
