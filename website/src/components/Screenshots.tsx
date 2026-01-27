import React, { useState } from 'react';
import { screenshots, Screenshot } from '../data/screenshots';

const Screenshots: React.FC = () => {
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);

  const openLightbox = (screenshot: Screenshot) => {
    setSelectedScreenshot(screenshot);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setSelectedScreenshot(null);
    document.body.style.overflow = 'unset';
  };

  const navigateScreenshot = (direction: 'prev' | 'next') => {
    if (!selectedScreenshot) return;
    const currentIndex = screenshots.findIndex(s => s.id === selectedScreenshot.id);
    let newIndex: number;

    if (direction === 'prev') {
      newIndex = currentIndex === 0 ? screenshots.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === screenshots.length - 1 ? 0 : currentIndex + 1;
    }

    setSelectedScreenshot(screenshots[newIndex]);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedScreenshot) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateScreenshot('prev');
      if (e.key === 'ArrowRight') navigateScreenshot('next');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedScreenshot]);

  return (
    <>
      <section id="screenshots" className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            See It In Action
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Explore the interface and discover how TimeTracker helps you understand your time
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {screenshots.map((screenshot) => (
              <div
                key={screenshot.id}
                className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => openLightbox(screenshot)}
              >
                <div className="aspect-video bg-gray-200 overflow-hidden">
                  <img
                    src={screenshot.thumbnail}
                    alt={screenshot.alt}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {screenshot.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">{screenshot.description}</p>
                  <ul className="space-y-1">
                    {screenshot.features.slice(0, 3).map((feature, index) => (
                      <li key={index} className="text-xs text-gray-500 flex items-center">
                        <span className="mr-2">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div
            className="max-w-5xl w-full max-h-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Close"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Navigation Buttons */}
            <button
              onClick={() => navigateScreenshot('prev')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Previous"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => navigateScreenshot('next')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Next"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Screenshot Image */}
            <div className="bg-white rounded-lg overflow-hidden">
              <img
                src={selectedScreenshot.image}
                alt={selectedScreenshot.alt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="p-6 bg-white">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedScreenshot.title}
                </h3>
                <p className="text-gray-600 mb-4">{selectedScreenshot.description}</p>
                <ul className="grid md:grid-cols-2 gap-2">
                  {selectedScreenshot.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-center">
                      <svg className="w-4 h-4 text-primary-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
              {screenshots.findIndex(s => s.id === selectedScreenshot.id) + 1} / {screenshots.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Screenshots;
