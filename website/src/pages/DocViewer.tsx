import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { getGitHubRawUrl } from '../config';

const DOC_URLS: Record<string, string> = {
  'overview': getGitHubRawUrl('docs/README.md'),
  'plugin-development': getGitHubRawUrl('docs/PLUGIN_DEVELOPMENT.md'),
  'sdk-reference': getGitHubRawUrl('docs/SDK_REFERENCE.md'),
};

const DOC_TITLES: Record<string, string> = {
  'overview': 'Documentation Overview',
  'plugin-development': 'Plugin Development Guide',
  'sdk-reference': 'SDK Reference',
};

function DocViewer() {
  const { docId } = useParams<{ docId: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId || !DOC_URLS[docId]) {
      setError('Document not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(DOC_URLS[docId])
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        return response.text();
      })
      .then((text) => {
        // Fix relative links to use HashRouter format with # prefix
        const fixedContent = text.replace(
          /\[([^\]]+)\]\(\.\/([^)]+)\)/g,
          (match, linkText, path) => {
            // Handle links with anchors (e.g., ./PLUGIN_DEVELOPMENT.md#examples)
            const [filePath, anchor] = path.split('#');
            const docMap: Record<string, string> = {
              'PLUGIN_DEVELOPMENT.md': 'plugin-development',
              'SDK_REFERENCE.md': 'sdk-reference',
              'README.md': 'overview',
            };
            const targetDoc = docMap[filePath];
            if (targetDoc) {
              // Use path format for React Router Link (HashRouter adds # automatically)
              // Format: /docs/docId or /docs/docId#anchor
              const anchorPart = anchor ? `#${anchor}` : '';
              return `[${linkText}](/docs/${targetDoc}${anchorPart})`;
            }
            return match;
          }
        );
        setContent(fixedContent);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [docId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [docId]);

  if (!docId || !DOC_URLS[docId]) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <main className="container mx-auto px-4 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Document Not Found</h1>
            <Link to="/docs" className="text-primary-600 dark:text-primary-400 hover:underline">
              Return to Documentation
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 pt-20 pb-8 max-w-5xl">
        <Link
          to="/docs"
          className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Documentation
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-2">Error Loading Document</h2>
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <a
              href={DOC_URLS[docId]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-primary-600 dark:text-primary-400 hover:underline"
            >
              View on GitHub instead
            </a>
          </div>
        )}

        {!loading && !error && (
          <>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
              {DOC_TITLES[docId]}
            </h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <MarkdownRenderer content={content} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default DocViewer;
