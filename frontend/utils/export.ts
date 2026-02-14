import { exportApi } from '../services/api/export';
import { showSuccess, handleApiError } from './toast';
import { format } from 'date-fns';
import type { DateRange } from '../types';

/**
 * Export data to CSV or JSON using backend API
 * This is the unified export function used across the application
 */
export async function exportData(
  dateRange: DateRange,
  options?: {
    defaultFileName?: string;
    format?: 'csv' | 'json';
  }
): Promise<void> {
  try {
    // Ensure dates are Date objects
    const normalizedRange = {
      start: dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start),
      end: dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end),
    };
    
    const dateStr = format(normalizedRange.start, 'yyyy-MM-dd');
    const defaultFileName = options?.defaultFileName || `timetracker-export-${dateStr}`;
    
    // Dynamically import dialog API
    const { save } = await import('@tauri-apps/api/dialog');
    
    // Show save dialog
    const filePath = await save({
      filters: [
        {
          name: 'CSV',
          extensions: ['csv'],
        },
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
      defaultPath: `${defaultFileName}.${options?.format || 'csv'}`,
    });

    if (!filePath) {
      // User cancelled the dialog
      return;
    }

    // Determine file format from extension
    const isJson = filePath.toLowerCase().endsWith('.json');

    // Export the data using backend API
    if (isJson) {
      await exportApi.exportToJson(normalizedRange, filePath);
    } else {
      await exportApi.exportToCsv(normalizedRange, filePath);
    }

    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
    showSuccess(`Data exported successfully to ${fileName}`);
  } catch (error) {
    handleApiError(error, 'Failed to export data');
  }
}
