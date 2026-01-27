// Configuration for GitHub repository and deployment
// Update these values according to your GitHub repository

export const config = {
  github: {
    username: 'bthos', // Replace with your GitHub username
    repository: 'time-tracker-app', // Replace if your repository has a different name
  },
  website: {
    baseUrl: 'https://bthos.github.io/time-tracker-app', // Update with your GitHub Pages URL
  },
};

export const getGitHubUrl = (path: string = '') => {
  return `https://github.com/${config.github.username}/${config.github.repository}${path}`;
};

export const getReleasesUrl = () => {
  return getGitHubUrl('/releases');
};

export const getLatestReleaseUrl = () => {
  return getGitHubUrl('/releases/latest');
};

/**
 * Get the correct path for public assets (images, etc.)
 * This function ensures that paths work correctly with Vite's base path configuration
 * @param path - Path to the asset (e.g., '/screenshots/reports.png')
 * @returns Correct path with base URL prefix if needed
 */
export const getAssetPath = (path: string): string => {
  // Remove leading slash if present, then add base URL
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = import.meta.env.BASE_URL;
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}${cleanBaseUrl ? '/' : ''}${cleanPath}`;
};
