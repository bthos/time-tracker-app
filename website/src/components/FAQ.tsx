import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: 'How does automatic tracking work?',
      answer: 'TimeTracker uses native operating system APIs to detect the active window and application. It tracks this information every few seconds (configurable, default 5 seconds) and aggregates it into time entries. The tracking happens in the background with minimal resource usage (<50MB RAM). This approach is 10-100x faster than web-based solutions that require constant internet connection.',
    },
    {
      question: 'Where is my data stored?',
      answer: 'All your data is stored locally on your computer in a SQLite database. The database file is located in your application data directory (Windows: %APPDATA%\\timetracker\\data.db, macOS: ~/Library/Application Support/timetracker/data.db, Linux: ~/.local/share/timetracker/data.db). No data is sent to any servers - your privacy is guaranteed. This makes TimeTracker GDPR compliant and perfect for sensitive business data.',
    },
    {
      question: 'Is it suitable for freelancers billing clients?',
      answer: 'Absolutely! TimeTracker is perfect for freelancers and consultants. It includes full billable time tracking with hourly rates, automatic revenue calculations, and CSV export for easy invoicing. You can track time across multiple clients and projects, mark activities as billable or non-billable, and generate detailed reports for client transparency.',
    },
    {
      question: 'How does it compare to Toggl or Clockify?',
      answer: 'Unlike Toggl and Clockify, which are web-based and require internet connection, TimeTracker is a desktop application that works completely offline. All data is stored locally (GDPR compliant), and tracking is 10-100x faster using native APIs. While Toggl/Clockify focus on cloud sync, TimeTracker prioritizes privacy and performance. It\'s free and open source, unlike many competitors that charge for advanced features.',
    },
    {
      question: 'Is my data GDPR compliant?',
      answer: 'Yes! TimeTracker is fully GDPR compliant. All data is stored locally on your device in a SQLite database. No data is transmitted to any servers, and there\'s no cloud sync by default. You have complete control over your data - you can export it, back it up, or delete it at any time. This makes it ideal for European users and businesses handling sensitive client information.',
    },
    {
      question: 'Can I use it offline?',
      answer: 'Yes! TimeTracker works completely offline. It\'s a desktop application that doesn\'t require internet connection for any core functionality. All tracking, reporting, and data management happens locally on your computer. You only need internet to download the application initially and for future updates.',
    },
    {
      question: 'How accurate is the automatic tracking?',
      answer: 'TimeTracker uses native operating system APIs for maximum accuracy. It tracks the active window and application title every few seconds (configurable, default 5 seconds) and aggregates this into time entries. The tracking is precise to the second level. For even more accuracy, you can manually adjust entries or use manual entry for meetings and offline activities.',
    },
    {
      question: 'Does it work on Linux?',
      answer: 'Yes! TimeTracker supports Windows, macOS, and Linux (Ubuntu 18.04+ / Debian 10+). The application uses native APIs for each platform to ensure optimal performance. On Linux, it supports all major desktop environments and works seamlessly with system tray integration.',
    },
    {
      question: 'How do I get started?',
      answer: 'Simply download and install TimeTracker for your platform from GitHub Releases. The application will start tracking automatically when you launch it. You can configure categories, projects, and settings to customize it to your workflow. No account creation or internet connection required!',
    },
    {
      question: 'Can I track billable hours?',
      answer: 'Yes! TimeTracker includes full billable time tracking with hourly rates. You can mark categories or projects as billable, set hourly rates, and track revenue automatically. Reports show billable vs non-billable breakdown, and you can export data to CSV for invoicing. Perfect for freelancers, consultants, and agencies.',
    },
    {
      question: 'What about idle time?',
      answer: 'TimeTracker has smart idle detection. When it detects inactivity (no mouse/keyboard input for a configurable period, default 2 minutes), it prompts you to classify that time. You can mark it as break, thinking, or other activities. This solves the "no mouse = slacking" problem. There\'s also a dedicated "Thinking Mode" button for focused work without active input.',
    },
    {
      question: 'Is it free?',
      answer: 'Yes! TimeTracker is completely free and open source. It\'s released under the MIT License, so you can use it, modify it, and distribute it freely. There are no hidden costs, subscription fees, or premium features locked behind paywalls.',
    },
    {
      question: 'Can I export my data?',
      answer: 'Yes, you can export your time tracking data in CSV or JSON formats. CSV exports include UTF-8 BOM for Excel compatibility, making it easy to import into accounting software or create invoices. You can export filtered data by date range, project, category, or domain. This ensures you always have access to your data.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Everything you need to know about TimeTracker
        </p>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 text-gray-600 border-t border-gray-200">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
