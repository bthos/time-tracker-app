import { getLatestReleaseUrl, getReleasesUrl } from '../config';

const Download: React.FC = () => {

  return (
    <section id="download" className="py-16 px-4 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto max-w-4xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Download TimeTracker
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Available for Windows, macOS, and Linux. Free and open source.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <a
            href={getLatestReleaseUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-primary-600 hover:shadow-lg transition-all text-center group"
          >
            <div className="text-4xl mb-4">🪟</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Windows</h3>
            <p className="text-gray-600 text-sm mb-4">Windows 10/11</p>
            <span className="text-primary-600 group-hover:text-primary-700 font-semibold">
              Download →
            </span>
          </a>

          <a
            href={getLatestReleaseUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-primary-600 hover:shadow-lg transition-all text-center group"
          >
            <div className="text-4xl mb-4">🍎</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">macOS</h3>
            <p className="text-gray-600 text-sm mb-4">macOS 10.15+</p>
            <span className="text-primary-600 group-hover:text-primary-700 font-semibold">
              Download →
            </span>
          </a>

          <a
            href={getLatestReleaseUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-primary-600 hover:shadow-lg transition-all text-center group"
          >
            <div className="text-4xl mb-4">🐧</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Linux</h3>
            <p className="text-gray-600 text-sm mb-4">Ubuntu 18.04+ / Debian 10+</p>
            <span className="text-primary-600 group-hover:text-primary-700 font-semibold">
              Download →
            </span>
          </a>
        </div>

        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">System Requirements</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Minimum Requirements</h4>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li>• ~100MB free disk space</li>
                <li>• ~50MB RAM minimum</li>
                <li>• Windows 10/11, macOS 10.15+, or Linux</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Features</h4>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li>• Automatic time tracking</li>
                <li>• Local data storage (SQLite)</li>
                <li>• Minimal resource usage</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href={getReleasesUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 font-semibold"
          >
            View all releases →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Download;
