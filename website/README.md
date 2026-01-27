# TimeTracker Marketing Website

Marketing website for TimeTracker application, deployed to GitHub Pages.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

The website is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the `main` branch.

The workflow is configured in `.github/workflows/deploy-website.yml`.

## Structure

- `src/components/` - React components
- `src/data/` - Data files (screenshots metadata)
- `public/` - Static assets (screenshots, favicon)
- `dist/` - Build output (generated, not committed)

## Configuration

1. **GitHub Repository**: Update `src/config.ts` with your GitHub username and repository name
2. **Base Path**: The `base` path in `vite.config.ts` is set to `/time-tracker-app/` for GitHub Pages deployment. If your repository name is different, update this value accordingly.
3. **Open Graph URLs**: Update the Open Graph URLs in `index.html` with your GitHub Pages URL

## Before Deployment

Make sure to update:
- `src/config.ts` - GitHub username and repository name
- `index.html` - Open Graph URLs (og:url, og:image, twitter:url, twitter:image)
- `vite.config.ts` - base path if repository name differs
