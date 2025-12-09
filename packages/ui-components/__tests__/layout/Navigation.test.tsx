/**
 * Navigation Component Tests
 * v13 Section 4.6
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNavigation, SidebarNavigation, Navigation } from '../../src/layout/Navigation';

describe('BottomNavigation', () => {
  it('should render with data-testid', () => {
    render(<BottomNavigation />);
    expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument();
  });

  it('should render default nav items', () => {
    render(<BottomNavigation />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should render custom items', () => {
    const items = [
      { id: 'custom1', label: 'Custom 1', icon: '⭐', path: '/custom1' },
      { id: 'custom2', label: 'Custom 2', icon: '🎯', path: '/custom2' },
    ];
    render(<BottomNavigation items={items} />);
    expect(screen.getByText('Custom 1')).toBeInTheDocument();
    expect(screen.getByText('Custom 2')).toBeInTheDocument();
  });

  it('should mark active item', () => {
    render(<BottomNavigation activeId="home" />);
    const homeItem = screen.getByTestId('nav-item-home');
    expect(homeItem).toHaveAttribute('aria-current', 'page');
  });

  it('should call onItemClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<BottomNavigation onItemClick={handleClick} />);

    fireEvent.click(screen.getByText('Profile'));

    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile' })
    );
  });

  it('should apply active styles to active item', () => {
    render(<BottomNavigation activeId="wallet" />);
    const item = screen.getByTestId('nav-item-wallet');
    expect(item.className).toContain('text-ownyou-primary');
  });

  it('should apply inactive styles to non-active items', () => {
    render(<BottomNavigation activeId="home" />);
    const item = screen.getByTestId('nav-item-wallet');
    expect(item.className).toContain('text-gray-400');
  });

  it('should limit to 5 items', () => {
    const items = [
      { id: '1', label: '1', icon: '1', path: '/1' },
      { id: '2', label: '2', icon: '2', path: '/2' },
      { id: '3', label: '3', icon: '3', path: '/3' },
      { id: '4', label: '4', icon: '4', path: '/4' },
      { id: '5', label: '5', icon: '5', path: '/5' },
      { id: '6', label: '6', icon: '6', path: '/6' },
    ];
    render(<BottomNavigation items={items} />);
    expect(screen.queryByText('6')).not.toBeInTheDocument();
  });
});

describe('SidebarNavigation', () => {
  it('should render with data-testid', () => {
    render(<SidebarNavigation />);
    expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument();
  });

  it('should render all default nav items', () => {
    render(<SidebarNavigation />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should mark active item', () => {
    render(<SidebarNavigation activeId="settings" />);
    const item = screen.getByTestId('sidebar-item-settings');
    expect(item).toHaveAttribute('aria-current', 'page');
  });

  it('should call onItemClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<SidebarNavigation onItemClick={handleClick} />);

    fireEvent.click(screen.getByText('Data'));

    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'data' })
    );
  });

  it('should apply active styles', () => {
    render(<SidebarNavigation activeId="data" />);
    const item = screen.getByTestId('sidebar-item-data');
    expect(item.className).toContain('bg-ownyou-primary/10');
    expect(item.className).toContain('text-ownyou-primary');
  });

  it('should have vertical layout', () => {
    render(<SidebarNavigation />);
    const nav = screen.getByTestId('sidebar-navigation');
    expect(nav.className).toContain('flex-col');
  });
});

describe('Navigation', () => {
  it('should render both bottom and sidebar navigation', () => {
    render(<Navigation />);
    // Both should be in DOM (one hidden via CSS)
    expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument();
  });

  it('should pass props to both navigations', () => {
    render(<Navigation activeId="profile" />);

    const bottomItem = screen.getByTestId('nav-item-profile');
    const sidebarItem = screen.getByTestId('sidebar-item-profile');

    expect(bottomItem).toHaveAttribute('aria-current', 'page');
    expect(sidebarItem).toHaveAttribute('aria-current', 'page');
  });
});
