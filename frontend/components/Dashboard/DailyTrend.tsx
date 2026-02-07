import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useStore } from '../../store';
import { useActivities } from '../../hooks';
import { useCategories } from '../../hooks/useCategories';
import LoadingSpinner from '../Common/LoadingSpinner';
import { differenceInCalendarDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export default function DailyTrend() {
  // Use selector to get only primitive values to prevent re-renders from object reference changes
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
  
  const { data: activities = [], isLoading: activitiesLoading } = useActivities();
  const { data: allCategories = [], isLoading: categoriesLoading } = useCategories();
  
  const { start, end } = useMemo(() => {
    const now = new Date();
    let range: { start: Date; end: Date };
    
    switch (dateRangePreset) {
      case 'today':
        range = {
          start: startOfDay(now),
          end: endOfDay(now),
        };
        break;
      case 'week':
        range = {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
        break;
      case 'month':
        range = {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
        break;
      case 'custom':
        range = {
          start: customStartTimestamp !== null ? new Date(customStartTimestamp) : startOfDay(now),
          end: customEndTimestamp !== null ? new Date(customEndTimestamp) : endOfDay(now),
        };
        break;
      default:
        range = {
          start: startOfDay(now),
          end: endOfDay(now),
        };
    }
    
    return {
      start: range.start,
      end: range.end,
    };
  }, [dateRangePreset, customStartTimestamp, customEndTimestamp]);
  
  // Only show for multi-day ranges (check if start and end are different calendar days)
  const isSingleDay = useMemo(() => start.toDateString() === end.toDateString(), [start, end]);
  
  const daysDiff = useMemo(() => Math.abs(differenceInCalendarDays(end, start)), [start, end]);

  // Calculate daily breakdown for trend chart
  const dailyStats = useMemo(() => {
    const days: Record<string, { productive: number; unproductive: number; total: number }> = {};

    // Initialize days in the selected range
    // Use the earlier date as start for iteration
    const rangeStart = start <= end ? start : end;
    
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      days[key] = { productive: 0, unproductive: 0, total: 0 };
    }

    // Process activities (filter out idle for consistency with Dashboard)
    const activeActivities = activities.filter(a => !a.is_idle);
    
    activeActivities.forEach((activity) => {
      const activityDate = new Date(activity.started_at * 1000);
      const dateKey = activityDate.toISOString().split('T')[0];
      
      if (days[dateKey]) {
        const category = allCategories.find(c => c.id === activity.category_id);
        const duration = activity.duration_sec;
        
        days[dateKey].total += duration;
        if (category?.is_productive === true) {
          days[dateKey].productive += duration;
        } else if (category?.is_productive === false) {
          days[dateKey].unproductive += duration;
        }
      }
    });

    return Object.entries(days).map(([date, stats]) => ({
      date,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      productive: Math.round((stats.productive / 3600) * 10) / 10,
      unproductive: Math.round((stats.unproductive / 3600) * 10) / 10,
      total: Math.round((stats.total / 3600) * 10) / 10,
    }));
  }, [activities, allCategories, start, end, daysDiff]);

  if (isSingleDay) {
    return null;
  }

  if (activitiesLoading || categoriesLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Daily Trend
        </h3>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (dailyStats.length === 0) {
    return null;
  }

  return (
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
  );
}
