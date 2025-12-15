/**
 * IkigaiWheel Component Tests
 * v13 Section 4.4
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IkigaiWheel } from '../../src/profile/IkigaiWheel';
import type { IkigaiDimension } from '../../src/types';

const mockDimensions: IkigaiDimension[] = [
  { name: 'passion', label: 'Passion', score: 80, color: '#FF6B6B' },
  { name: 'mission', label: 'Mission', score: 60, color: '#4ECDC4' },
  { name: 'profession', label: 'Profession', score: 40, color: '#45B7D1' },
  { name: 'vocation', label: 'Vocation', score: 20, color: '#96CEB4' },
];

describe('IkigaiWheel', () => {
  it('should render with data-testid', () => {
    render(<IkigaiWheel />);
    expect(screen.getByTestId('ikigai-wheel')).toBeInTheDocument();
  });

  it('should render SVG', () => {
    render(<IkigaiWheel />);
    const wheel = screen.getByTestId('ikigai-wheel');
    expect(wheel.querySelector('svg')).toBeInTheDocument();
  });

  it('should render dimension labels when showLabels is true', () => {
    render(<IkigaiWheel dimensions={mockDimensions} showLabels />);
    expect(screen.getByText('Passion')).toBeInTheDocument();
    expect(screen.getByText('Mission')).toBeInTheDocument();
    expect(screen.getByText('Profession')).toBeInTheDocument();
    expect(screen.getByText('Vocation')).toBeInTheDocument();
  });

  it('should hide labels when showLabels is false', () => {
    render(<IkigaiWheel dimensions={mockDimensions} showLabels={false} />);
    expect(screen.queryByText('Passion')).not.toBeInTheDocument();
  });

  it('should render scores when showScores is true', () => {
    render(<IkigaiWheel dimensions={mockDimensions} showScores />);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should hide scores when showScores is false', () => {
    render(<IkigaiWheel dimensions={mockDimensions} showScores={false} />);
    expect(screen.queryByText('80%')).not.toBeInTheDocument();
  });

  it('should render with small size', () => {
    render(<IkigaiWheel size="small" />);
    const wheel = screen.getByTestId('ikigai-wheel');
    expect(wheel).toHaveStyle({ width: '150px', height: '150px' });
  });

  it('should render with medium size', () => {
    render(<IkigaiWheel size="medium" />);
    const wheel = screen.getByTestId('ikigai-wheel');
    expect(wheel).toHaveStyle({ width: '200px', height: '200px' });
  });

  it('should render with large size', () => {
    render(<IkigaiWheel size="large" />);
    const wheel = screen.getByTestId('ikigai-wheel');
    expect(wheel).toHaveStyle({ width: '280px', height: '280px' });
  });

  it('should render background circles', () => {
    render(<IkigaiWheel />);
    const wheel = screen.getByTestId('ikigai-wheel');
    const circles = wheel.querySelectorAll('circle[stroke-dasharray="4 4"]');
    expect(circles.length).toBe(4); // 25%, 50%, 75%, 100%
  });

  it('should render data points', () => {
    render(<IkigaiWheel dimensions={mockDimensions} />);
    const wheel = screen.getByTestId('ikigai-wheel');
    // Each dimension has a data point circle with white stroke
    const dataPoints = wheel.querySelectorAll('circle[stroke="white"]');
    expect(dataPoints.length).toBe(4);
  });

  it('should render filled path', () => {
    render(<IkigaiWheel dimensions={mockDimensions} />);
    const wheel = screen.getByTestId('ikigai-wheel');
    // The path uses hex color with alpha (from design tokens)
    const path = wheel.querySelector('path[d]');
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute('fill');
  });

  it('should apply custom className', () => {
    render(<IkigaiWheel className="custom-class" />);
    const wheel = screen.getByTestId('ikigai-wheel');
    expect(wheel.className).toContain('custom-class');
  });
});
