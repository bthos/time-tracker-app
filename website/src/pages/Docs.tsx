import { useEffect } from 'react';
import Header from '../components/Header';
import Docs from '../components/Docs';
import Footer from '../components/Footer';

function DocsPage() {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      <main className="pt-20">
        <Docs />
      </main>
      <Footer />
    </div>
  );
}

export default DocsPage;
