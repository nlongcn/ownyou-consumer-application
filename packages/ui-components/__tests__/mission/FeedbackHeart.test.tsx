/**
 * FeedbackHeart Tests
 * v13 Section 4.5.3
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackHeart } from '../../src/mission/FeedbackHeart';

describe('FeedbackHeart', () => {
  it('should render with default meh state', () => {
    render(<FeedbackHeart />);
    const heart = screen.getByRole('button');
    expect(heart).toHaveAttribute('data-state', 'meh');
    expect(heart).toHaveAttribute('aria-label', 'Feedback: meh');
  });

  it('should render with initial state', () => {
    render(<FeedbackHeart initialState="like" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'like');
  });

  it('should cycle meh → like on click', () => {
    const handleChange = vi.fn();
    render(<FeedbackHeart onStateChange={handleChange} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleChange).toHaveBeenCalledWith('like');
  });

  it('should cycle like → love on click', () => {
    const handleChange = vi.fn();
    render(<FeedbackHeart initialState="like" onStateChange={handleChange} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleChange).toHaveBeenCalledWith('love');
  });

  it('should cycle love → meh on click', () => {
    const handleChange = vi.fn();
    render(<FeedbackHeart initialState="love" onStateChange={handleChange} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleChange).toHaveBeenCalledWith('meh');
  });

  it('should complete full cycle meh → like → love → meh', () => {
    const handleChange = vi.fn();
    render(<FeedbackHeart onStateChange={handleChange} />);
    const heart = screen.getByRole('button');

    // meh → like
    fireEvent.click(heart);
    expect(handleChange).toHaveBeenNthCalledWith(1, 'like');

    // like → love
    fireEvent.click(heart);
    expect(handleChange).toHaveBeenNthCalledWith(2, 'love');

    // love → meh
    fireEvent.click(heart);
    expect(handleChange).toHaveBeenNthCalledWith(3, 'meh');
  });

  it('should show gray heart emoji for meh state', () => {
    render(<FeedbackHeart initialState="meh" />);
    expect(screen.getByText('🩶')).toBeInTheDocument();
  });

  it('should show red heart emoji for like state', () => {
    render(<FeedbackHeart initialState="like" />);
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('should show red heart emoji for love state', () => {
    render(<FeedbackHeart initialState="love" />);
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('should apply scale-125 for love state', () => {
    render(<FeedbackHeart initialState="love" />);
    const heart = screen.getByRole('button');
    expect(heart.className).toContain('scale-125');
  });

  it('should render with small size', () => {
    render(<FeedbackHeart size="small" />);
    const heart = screen.getByRole('button');
    expect(heart.className).toContain('w-6');
    expect(heart.className).toContain('h-6');
  });

  it('should render with default size', () => {
    render(<FeedbackHeart size="default" />);
    const heart = screen.getByRole('button');
    expect(heart.className).toContain('w-7');
    expect(heart.className).toContain('h-7');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<FeedbackHeart disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not call onStateChange when disabled', () => {
    const handleChange = vi.fn();
    render(<FeedbackHeart disabled onStateChange={handleChange} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<FeedbackHeart className="custom-class" />);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });

  it('should have aria-pressed attribute', () => {
    render(<FeedbackHeart initialState="meh" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('should have aria-pressed=true when not meh', () => {
    render(<FeedbackHeart initialState="like" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
