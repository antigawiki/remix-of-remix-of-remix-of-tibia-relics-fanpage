import { ReactNode } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';
import Breadcrumb from '@/components/Breadcrumb';

interface MainLayoutProps {
  children: ReactNode;
  showSidebars?: boolean;
  showRightSidebar?: boolean;
}

const MainLayout = ({ children, showSidebars = true, showRightSidebar = true }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-6">
        {showSidebars ? (
          <div className={`grid grid-cols-1 ${showRightSidebar ? 'lg:grid-cols-[200px_1fr_200px]' : 'lg:grid-cols-[200px_1fr]'} gap-6`}>
            {/* Left Sidebar */}
            <div className="hidden lg:block">
              <Sidebar position="left" />
            </div>

            {/* Main Content */}
            <div className="min-w-0">
              <Breadcrumb />
              {children}
            </div>

            {/* Right Sidebar */}
            {showRightSidebar && (
              <div className="hidden lg:block">
                <Sidebar position="right" />
              </div>
            )}
          </div>
        ) : (
          <>
            <Breadcrumb />
            {children}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MainLayout;
