/**
 * OwnYouLogo Component Tests
 * v13 Section 4.4
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OwnYouLogo } from '../../src/branding/OwnYouLogo';

describe('OwnYouLogo', () => {
  it('should render with data-testid', () => {
    render(<OwnYouLogo />);
    expect(screen.getByTestId('ownyou-logo')).toBeInTheDocument();
  });

  it('should render text by default', () => {
    render(<OwnYouLogo />);
    expect(screen.getByText('OwnYou')).toBeInTheDocument();
  });

  it('should hide text when showText is false', () => {
    render(<OwnYouLogo showText={false} />);
    expect(screen.queryByText('OwnYou')).not.toBeInTheDocument();
  });

  it('should render with small size', () => {
    render(<OwnYouLogo size="small" />);
    const logo = screen.getByTestId('ownyou-logo');
    const text = screen.getByText('OwnYou');
    expect(text.className).toContain('text-lg');
  });

  it('should render with medium size', () => {
    render(<OwnYouLogo size="medium" />);
    const text = screen.getByText('OwnYou');
    expect(text.className).toContain('text-xl');
  });

  it('should render with large size', () => {
    render(<OwnYouLogo size="large" />);
    const text = screen.getByText('OwnYou');
    expect(text.className).toContain('text-2xl');
  });

  it('should apply custom className', () => {
    render(<OwnYouLogo className="custom-class" />);
    const logo = screen.getByTestId('ownyou-logo');
    expect(logo.className).toContain('custom-class');
  });

  it('should have display font', () => {
    render(<OwnYouLogo />);
    const text = screen.getByText('OwnYou');
    expect(text.className).toContain('font-display');
  });

  it('should have bold font weight', () => {
    render(<OwnYouLogo />);
    const text = screen.getByText('OwnYou');
    expect(text.className).toContain('font-bold');
  });
});
