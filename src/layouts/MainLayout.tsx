import { ReactNode } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';

interface MainLayoutProps {
  children: ReactNode;
  showSidebars?: boolean;
}

const MainLayout = ({ children, showSidebars = true }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-6">
        {showSidebars ? (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block">
              <Sidebar position="left" />
            </div>

            {/* Main Content */}
            <div className="min-w-0">
              {children}
            </div>

            {/* Right Sidebar */}
            <div className="hidden lg:block">
              <Sidebar position="right" />
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MainLayout;
