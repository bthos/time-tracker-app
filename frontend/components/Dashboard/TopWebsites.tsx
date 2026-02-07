import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import { api } from '../../services/api';
import { useStore } from '../../store';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatDuration, calculatePercentage } from '../../utils/format';
import Card from '../Common/Card';
import LoadingSpinner from '../Common/LoadingSpinner';

export default function TopWebsites() {
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

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ['topDomains', dateRange.start.getTime(), dateRange.end.getTime()],
    queryFn: () => api.domains.getTopDomains(dateRange, 10),
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', dateRange.start.getTime(), dateRange.end.getTime()],
    queryFn: () => api.activities.getActivities(dateRange),
  });

  const totalDuration = useMemo(() => {
    if (!activities || activities.length === 0) return 0;
    return activities
      .filter(a => !a.is_idle && a.domain)
      .reduce((sum, a) => sum + a.duration_sec, 0);
  }, [activities]);

  const isLoading = domainsLoading || activitiesLoading;

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  const domainsList = domains || [];
  const maxDuration = domainsList.length > 0 ? domainsList[0].duration_sec : 1;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Websites</h3>
      </div>
      
      <div className="space-y-5">
        {domainsList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No website activity recorded for this period
          </div>
        ) : (
          domainsList.map((domain, index) => {
            const percentage = calculatePercentage(domain.duration_sec, totalDuration);
            const barWidth = calculatePercentage(domain.duration_sec, maxDuration);
            
            // Format domain name nicely (remove www. and protocol if present)
            const displayDomain = domain.domain
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .split('/')[0]; // Remove path

            return (
              <div key={domain.domain} className="relative group">
                {/* Domain info */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-gray-400 dark:text-gray-500 text-sm font-bold w-6 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate">
                      {displayDomain}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      {formatDuration(domain.duration_sec)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out shadow-sm bg-blue-500"
                    style={{
                      width: `${barWidth}%`,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
