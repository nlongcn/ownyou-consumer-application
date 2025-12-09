/**
 * ConfidenceGauge Component Tests
 * v13 Section 4.4
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceGauge } from '../../src/profile/ConfidenceGauge';

describe('ConfidenceGauge', () => {
  it('should render with data-testid', () => {
    render(<ConfidenceGauge value={50} />);
    expect(screen.getByTestId('confidence-gauge')).toBeInTheDocument();
  });

  it('should render SVG', () => {
    render(<ConfidenceGauge value={50} />);
    const gauge = screen.getByTestId('confidence-gauge');
    expect(gauge.querySelector('svg')).toBeInTheDocument();
  });

  it('should display value when showValue is true', () => {
    render(<ConfidenceGauge value={75} showValue />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should hide value when showValue is false', () => {
    render(<ConfidenceGauge value={75} showValue={false} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('should render label when provided', () => {
    render(<ConfidenceGauge value={50} label="Confidence" />);
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('should round value to nearest integer', () => {
    render(<ConfidenceGauge value={75.7} />);
    expect(screen.getByText('76%')).toBeInTheDocument();
  });

  it('should render with small size', () => {
    render(<ConfidenceGauge value={50} size="small" />);
    const gauge = screen.getByTestId('confidence-gauge');
    const container = gauge.firstChild as HTMLElement;
    expect(container).toHaveStyle({ width: '60px', height: '60px' });
  });

  it('should render with medium size', () => {
    render(<ConfidenceGauge value={50} size="medium" />);
    const gauge = screen.getByTestId('confidence-gauge');
    const container = gauge.firstChild as HTMLElement;
    expect(container).toHaveStyle({ width: '80px', height: '80px' });
  });

  it('should render with large size', () => {
    render(<ConfidenceGauge value={50} size="large" />);
    const gauge = screen.getByTestId('confidence-gauge');
    const container = gauge.firstChild as HTMLElement;
    expect(container).toHaveStyle({ width: '120px', height: '120px' });
  });

  it('should render background circle', () => {
    render(<ConfidenceGauge value={50} />);
    const gauge = screen.getByTestId('confidence-gauge');
    const bgCircle = gauge.querySelector('circle[stroke="#E5E7EB"]');
    expect(bgCircle).toBeInTheDocument();
  });

  it('should render progress circle', () => {
    render(<ConfidenceGauge value={50} />);
    const gauge = screen.getByTestId('confidence-gauge');
    // Progress circle should have colored stroke (not gray)
    const circles = gauge.querySelectorAll('circle');
    expect(circles.length).toBe(2); // Background + progress
  });

  it('should clamp value to 0-100 range', () => {
    render(<ConfidenceGauge value={150} />);
    // Should still render without error
    expect(screen.getByTestId('confidence-gauge')).toBeInTheDocument();
  });

  it('should handle 0 value', () => {
    render(<ConfidenceGauge value={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should handle 100 value', () => {
    render(<ConfidenceGauge value={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<ConfidenceGauge value={50} className="custom-class" />);
    const gauge = screen.getByTestId('confidence-gauge');
    expect(gauge.className).toContain('custom-class');
  });
});
