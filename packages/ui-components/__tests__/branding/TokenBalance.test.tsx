/**
 * TokenBalance Component Tests
 * v13 Section 4.4
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenBalance } from '../../src/branding/TokenBalance';

describe('TokenBalance', () => {
  it('should render with data-testid', () => {
    render(<TokenBalance balance={100} />);
    expect(screen.getByTestId('token-balance')).toBeInTheDocument();
  });

  it('should display balance', () => {
    render(<TokenBalance balance={1234} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should format large numbers with commas', () => {
    render(<TokenBalance balance={1234567} />);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('should show icon by default', () => {
    render(<TokenBalance balance={100} />);
    expect(screen.getByText('🪙')).toBeInTheDocument();
  });

  it('should hide icon when showIcon is false', () => {
    render(<TokenBalance balance={100} showIcon={false} />);
    expect(screen.queryByText('🪙')).not.toBeInTheDocument();
  });

  it('should render as button when onClick is provided', () => {
    render(<TokenBalance balance={100} onClick={() => {}} />);
    const element = screen.getByTestId('token-balance');
    expect(element.tagName).toBe('BUTTON');
  });

  it('should render as div when no onClick', () => {
    render(<TokenBalance balance={100} />);
    const element = screen.getByTestId('token-balance');
    expect(element.tagName).toBe('DIV');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<TokenBalance balance={100} onClick={handleClick} />);

    fireEvent.click(screen.getByTestId('token-balance'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render with small size', () => {
    render(<TokenBalance balance={100} size="small" />);
    const element = screen.getByTestId('token-balance');
    expect(element.className).toContain('px-2');
    expect(element.className).toContain('py-1');
  });

  it('should render with medium size', () => {
    render(<TokenBalance balance={100} size="medium" />);
    const element = screen.getByTestId('token-balance');
    expect(element.className).toContain('px-3');
  });

  it('should render with large size', () => {
    render(<TokenBalance balance={100} size="large" />);
    const element = screen.getByTestId('token-balance');
    expect(element.className).toContain('px-4');
    expect(element.className).toContain('py-2');
  });

  it('should apply custom className', () => {
    render(<TokenBalance balance={100} className="custom-class" />);
    const element = screen.getByTestId('token-balance');
    expect(element.className).toContain('custom-class');
  });

  it('should have rounded-full styling', () => {
    render(<TokenBalance balance={100} />);
    const element = screen.getByTestId('token-balance');
    expect(element.className).toContain('rounded-full');
  });
});
