import { Routes, Route } from 'react-router-dom';
import { Shell, BottomNavigation, SidebarNavigation } from '@ownyou/ui-components';
import { Home } from './routes/Home';
import { Profile } from './routes/Profile';
import { Settings } from './routes/Settings';
import { Wallet } from './routes/Wallet';
import { MissionDetail } from './routes/MissionDetail';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { isMobile } from './utils/platform';

export function App() {
  // Enable keyboard navigation
  useKeyboardNav();

  const mobile = isMobile();

  return (
    <Shell>
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        {!mobile && (
          <aside className="hidden md:flex">
            <SidebarNavigation />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/mission/:id" element={<MissionDetail />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {mobile && (
        <nav className="fixed bottom-0 left-0 right-0 md:hidden">
          <BottomNavigation />
        </nav>
      )}
    </Shell>
  );
}
