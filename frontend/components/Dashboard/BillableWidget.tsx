import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Clock, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatDuration, calculatePercentage } from '../../utils/format';
import Card from '../Common/Card';
import LoadingSpinner from '../Common/LoadingSpinner';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// TODO: This widget displays billable hours and revenue calculated from both categories and projects.
// The calculation logic is in database.rs (get_billable_hours, get_billable_revenue).
// Consider if we need to show breakdown by source (category vs project) or if unified view is sufficient.
// See TODO comments in database.rs and Dashboard.tsx for billable logic unification discussion.
export default function BillableWidget() {
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

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', dateRange.start.getTime(), dateRange.end.getTime()],
    queryFn: () => api.activities.getActivities(dateRange),
  });

  const { data: billableHours, isLoading: hoursLoading } = useQuery({
    queryKey: ['billableHours', dateRange.start.getTime(), dateRange.end.getTime()],
    queryFn: () => api.billable.getBillableHours(dateRange),
  });

  const { data: billableRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['billableRevenue', dateRange.start.getTime(), dateRange.end.getTime()],
    queryFn: () => api.billable.getBillableRevenue(dateRange),
  });

  const isLoading = activitiesLoading || hoursLoading || revenueLoading;

  const totalHours = useMemo(() => {
    if (!activities || activities.length === 0) return 0;
    return activities
      .filter(a => !a.is_idle)
      .reduce((sum, a) => sum + a.duration_sec, 0);
  }, [activities]);

  const billableHoursValue = billableHours ?? 0;
  const billablePercentage = calculatePercentage(billableHoursValue, totalHours);
  const revenue = billableRevenue ?? 0;

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
          <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Billable Time</h3>
      </div>

      <div className="space-y-6">
        {/* Billable Hours */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Billable Hours</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatDuration(billableHoursValue)}
            </span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-700"
              style={{ width: `${billablePercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {billablePercentage.toFixed(1)}% of total time
          </p>
        </div>

        {/* Revenue */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue</span>
            </div>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(revenue)}
            </span>
          </div>
        </div>

        {/* Billable Percentage Badge */}
        {billablePercentage > 0 && (
          <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {billablePercentage >= 50 
                ? 'Great! Most of your time is billable.'
                : billablePercentage >= 25
                ? 'Good progress on billable time.'
                : 'Consider tracking more billable activities.'}
            </span>
          </div>
        )}

        {billableHoursValue === 0 && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No billable time recorded for this period
          </div>
        )}
      </div>
    </Card>
  );
}
