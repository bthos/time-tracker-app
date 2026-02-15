import { FC } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { scrollToElement } from '../utils/scroll';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Helper function to extract text content from React children
const extractText = (children: any): string => {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(extractText).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    return extractText(children.props.children);
  }
  return '';
};

// Helper function to generate ID from heading text (slugify)
const generateHeadingId = (children: any): string => {
  const text = extractText(children);
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

const MarkdownRenderer: FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-lg dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ node, children, ...props }: any) => {
            const id = generateHeadingId(children);
            return (
              <h1 id={id} className="text-4xl font-bold text-gray-900 dark:text-white mb-6 mt-8 border-b border-gray-200 dark:border-gray-700 pb-3" {...props}>
                {children}
              </h1>
            );
          },
          h2: ({ node, children, ...props }: any) => {
            const id = generateHeadingId(children);
            return (
              <h2 id={id} className="text-3xl font-bold text-gray-900 dark:text-white mb-4 mt-8 border-b border-gray-200 dark:border-gray-700 pb-2" {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ node, children, ...props }: any) => {
            const id = generateHeadingId(children);
            return (
              <h3 id={id} className="text-2xl font-semibold text-gray-900 dark:text-white mb-3 mt-6" {...props}>
                {children}
              </h3>
            );
          },
          h4: ({ node, children, ...props }: any) => {
            const id = generateHeadingId(children);
            return (
              <h4 id={id} className="text-xl font-semibold text-gray-900 dark:text-white mb-2 mt-4" {...props}>
                {children}
              </h4>
            );
          },
          p: ({ node, ...props }) => (
            <p className="text-gray-700 dark:text-gray-300 mb-4 leading-7" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-2 ml-4" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-2 ml-4" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-gray-700 dark:text-gray-300" {...props} />
          ),
          code: ({ node, inline, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-gray-100 dark:bg-gray-800 text-primary-600 dark:text-primary-400 px-2 py-1 rounded text-sm font-mono" {...props} />
              );
            }
            return (
              <code className="block bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm" {...props} />
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto mb-4" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-primary-500 dark:border-primary-400 pl-4 italic text-gray-600 dark:text-gray-400 my-4" {...props} />
          ),
          a: ({ node, href, children, ...props }: any) => {
            // Hash-only links (e.g., #overview) - for in-page scrolling
            // These should scroll within the current page without triggering route changes
            if (href && href.startsWith('#') && !href.startsWith('#/')) {
              return (
                <a
                  href={href}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent HashRouter from handling this click
                    const id = href.substring(1);
                    scrollToElement(id);
                    // Don't update URL hash - keep current HashRouter route intact
                    // The URL should remain as /#/docs/plugin-development, not change to /#overview
                  }}
                  {...props}
                >
                  {children}
                </a>
              );
            }
            // If it's an internal docs link (/#/docs/...), use React Router Link
            if (href && href.startsWith('/#/docs/')) {
              // HashRouter automatically adds #, so we use the path without /#
              const routePath = href.replace('/#', '');
              return (
                <Link
                  to={routePath}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
                  {...props}
                >
                  {children}
                </Link>
              );
            }
            // Also handle /docs/... links (without #) for consistency
            if (href && href.startsWith('/docs/')) {
              return (
                <Link
                  to={href}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
                  {...props}
                >
                  {children}
                </Link>
              );
            }
            // External links or other links use regular anchor tag
            return (
              <a
                href={href}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-300 dark:border-gray-700" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-100 dark:bg-gray-800" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold text-gray-900 dark:text-white" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-gray-700 dark:text-gray-300" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-8 border-gray-300 dark:border-gray-700" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
