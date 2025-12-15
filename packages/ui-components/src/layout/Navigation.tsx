/**
 * Navigation Components - Bottom nav (mobile) and Sidebar (desktop)
 * v13 Section 4.6 - Navigation Components
 */

import { cn } from '@ownyou/ui-design-system';
import type { NavItem } from '../types';

// Default navigation items
const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/' },
  { id: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
  { id: 'wallet', label: 'Wallet', icon: '💰', path: '/wallet' },
  { id: 'data', label: 'Data', icon: '📊', path: '/data' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
];

export interface NavigationProps {
  /** Navigation items */
  items?: NavItem[];
  /** Currently active item id */
  activeId?: string;
  /** Item click handler */
  onItemClick?: (item: NavItem) => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Bottom navigation bar for mobile
 */
export function BottomNavigation({
  items = DEFAULT_NAV_ITEMS,
  activeId,
  onItemClick,
  className,
}: NavigationProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-around',
        'bg-card-bg',
        'px-2 py-3',
        'border-t border-gray-100',
        'shadow-lg',
        className,
      )}
      role="navigation"
      aria-label="Main navigation"
      data-testid="bottom-navigation"
    >
      {items.slice(0, 5).map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            className={cn(
              'flex flex-col items-center gap-1',
              'px-3 py-1',
              'rounded-nav',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ownyou-primary',
              isActive
                ? 'text-ownyou-primary'
                : 'text-gray-400 hover:text-gray-600',
            )}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`nav-item-${item.id}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-label text-[10px]">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sidebar navigation for desktop
 */
export function SidebarNavigation({
  items = DEFAULT_NAV_ITEMS,
  activeId,
  onItemClick,
  className,
}: NavigationProps) {
  return (
    <nav
      className={cn(
        'flex flex-col gap-2',
        'bg-card-bg',
        'p-4 h-full',
        'border-r border-gray-100',
        className,
      )}
      aria-label="Main navigation"
      data-testid="sidebar-navigation"
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            className={cn(
              'flex items-center gap-3',
              'px-4 py-3',
              'rounded-nav',
              'transition-colors duration-200',
              'text-left w-full',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ownyou-primary',
              isActive
                ? 'bg-ownyou-primary/10 text-ownyou-primary'
                : 'text-gray-600 hover:bg-gray-100',
            )}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`sidebar-item-${item.id}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-display text-sm font-bold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Responsive navigation that shows bottom nav on mobile and sidebar on desktop
 */
export function Navigation(props: NavigationProps) {
  return (
    <>
      {/* Mobile: Bottom Navigation */}
      <div className="lg:hidden">
        <BottomNavigation {...props} />
      </div>

      {/* Desktop: Sidebar Navigation */}
      <div className="hidden lg:block h-full">
        <SidebarNavigation {...props} />
      </div>
    </>
  );
}

export default Navigation;
