/**
 * Shell Component - Main app wrapper
 * v13 Section 4.6 - Navigation Components
 */

import React from 'react';
import { cn } from '@ownyou/ui-design-system';

export interface ShellProps {
  /** Child content */
  children: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Header component */
  header?: React.ReactNode;
  /** Navigation component (bottom nav on mobile, sidebar on desktop) */
  navigation?: React.ReactNode;
  /** Show sidebar on desktop */
  showSidebar?: boolean;
}

/**
 * Main application shell with sky blue background
 * Handles header, navigation, and main content layout
 */
export function Shell({
  children,
  className,
  header,
  navigation,
  showSidebar = true,
}: ShellProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-ownyou-primary',
        'flex flex-col',
        className,
      )}
      data-testid="shell"
    >
      {/* Header */}
      {header && (
        <header className="sticky top-0 z-40 bg-ownyou-primary">
          {header}
        </header>
      )}

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Sidebar (desktop only) */}
        {showSidebar && navigation && (
          <aside className="hidden lg:block w-64 flex-shrink-0">
            {navigation}
          </aside>
        )}

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 p-[10px]',
            'pb-20 lg:pb-4', // Extra padding for bottom nav on mobile
          )}
        >
          {children}
        </main>
      </div>

      {/* Bottom Navigation (mobile only) */}
      {navigation && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          {navigation}
        </nav>
      )}
    </div>
  );
}

export default Shell;
