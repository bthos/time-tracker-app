import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import CustomToaster from './components/Common/CustomToast';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchInterval: 1000 * 30, // 30 seconds
      retry: 1, // Retry failed requests once
      retryDelay: 1000, // Wait 1 second before retry
      refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: 1,
    },
  },
});

// Update splash screen status
const updateSplashStatus = (status: string) => {
  const statusElement = document.getElementById('splash-status');
  if (statusElement) {
    statusElement.classList.add('updating');
    // Save base text for timer updates
    statusElement.setAttribute('data-base-text', status);
    // Update immediately without delay for faster loading
    requestAnimationFrame(() => {
      // Get current timer value - prioritize getting from window function for accuracy
      let timerValue: string | null = null;
      
      // First, try to get elapsed time from timer function (most accurate)
      const getTimerElapsed = (window as Window & { getTimerElapsed?: () => number | null }).getTimerElapsed;
      if (getTimerElapsed) {
        const elapsed = getTimerElapsed();
        if (elapsed !== null && elapsed !== undefined) {
          timerValue = String(elapsed);
        }
      }
      
      // Fallback: try to extract timer from current text
      if (timerValue === null) {
        const currentText = statusElement.textContent || '';
        const timerMatch = currentText.match(/\((\d+)s\)$/);
        if (timerMatch) {
          timerValue = timerMatch[1];
        }
      }
      
      // Always include timer if we have a value, otherwise just show status
      if (timerValue !== null) {
        statusElement.textContent = `${status} (${timerValue}s)`;
      } else {
        statusElement.textContent = status;
      }
      statusElement.classList.remove('updating');
    });
  }
};

// Fallback: hide splash screen after max 4 seconds (in case settings never load)
let maxSplashTime: ReturnType<typeof setTimeout> | null = setTimeout(() => {
  hideSplashScreen();
}, 4000);

// Hide splash screen and show app when React is ready
const hideSplashScreen = () => {
  // Clear fallback timeout if splash screen hides normally
  if (maxSplashTime) {
    clearTimeout(maxSplashTime);
    maxSplashTime = null;
  }
  
  // Stop loading timer
  const stopLoadingTimer = (window as Window & { stopLoadingTimer?: () => void }).stopLoadingTimer;
  if (stopLoadingTimer) {
    stopLoadingTimer();
  }
  
  const splashScreen = document.getElementById('splash-screen');
  const root = document.getElementById('root');
  
  if (splashScreen && !splashScreen.classList.contains('hidden')) {
    splashScreen.classList.add('hidden');
    // Remove splash screen from DOM after animation
    setTimeout(() => {
      splashScreen.remove();
    }, 500);
  }
  
  if (root) {
    root.classList.add('loaded');
  }
};

// Make updateSplashStatus and hideSplashScreen available globally for App.tsx
(window as Window & { updateSplashStatus?: (status: string) => void; hideSplashScreen?: () => void }).updateSplashStatus = updateSplashStatus;
(window as Window & { updateSplashStatus?: (status: string) => void; hideSplashScreen?: () => void }).hideSplashScreen = hideSplashScreen;

// Update status during initialization
updateSplashStatus('Preparing application...');

// Render React app
const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <CustomToaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

// Update status when React starts mounting
requestAnimationFrame(() => {
  updateSplashStatus('Initializing React...');
  
  // Use double RAF to ensure React has started rendering
  requestAnimationFrame(() => {
    updateSplashStatus('Setting up providers...');
  });
});
