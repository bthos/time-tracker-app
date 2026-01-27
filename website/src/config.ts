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
