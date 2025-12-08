/**
 * FeedbackButtons Component Tests
 *
 * Tests for size variants, selected state, disabled state, and accessibility.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackButtons } from '../FeedbackButtons';
import type { FeedbackRating } from '../types';

describe('FeedbackButtons', () => {
  describe('Rendering', () => {
    it('should render all three feedback buttons', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      expect(screen.getByTestId('feedback-love')).toBeDefined();
      expect(screen.getByTestId('feedback-like')).toBeDefined();
      expect(screen.getByTestId('feedback-meh')).toBeDefined();
    });

    it('should render feedback buttons container with correct role', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      const container = screen.getByTestId('feedback-buttons');
      expect(container.getAttribute('role')).toBe('group');
      expect(container.getAttribute('aria-label')).toBe('Mission feedback');
    });

    it('should render emoji content in each button', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      expect(screen.getByTestId('feedback-love').textContent).toContain('❤️');
      expect(screen.getByTestId('feedback-like').textContent).toContain('👍');
      expect(screen.getByTestId('feedback-meh').textContent).toContain('😐');
    });
  });

  describe('Size variants', () => {
    it('should apply small size classes when size="sm"', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} size="sm" />);

      const button = screen.getByTestId('feedback-love');
      expect(button.className).toContain('px-2');
      expect(button.className).toContain('py-1');
      expect(button.className).toContain('text-sm');
    });

    it('should apply medium size classes when size="md"', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} size="md" />);

      const button = screen.getByTestId('feedback-love');
      expect(button.className).toContain('px-3');
      expect(button.className).toContain('py-1.5');
      expect(button.className).toContain('text-base');
    });

    it('should apply large size classes when size="lg"', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} size="lg" />);

      const button = screen.getByTestId('feedback-love');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('py-2');
      expect(button.className).toContain('text-lg');
    });

    it('should default to medium size', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      const button = screen.getByTestId('feedback-love');
      expect(button.className).toContain('px-3');
      expect(button.className).toContain('text-base');
    });
  });

  describe('Selected state', () => {
    it('should highlight selected "love" button', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} selected="love" />);

      const loveButton = screen.getByTestId('feedback-love');
      const likeButton = screen.getByTestId('feedback-like');

      expect(loveButton.className).toContain('border-blue-500');
      expect(loveButton.className).toContain('bg-blue-50');
      expect(loveButton.getAttribute('aria-pressed')).toBe('true');

      expect(likeButton.className).not.toContain('border-blue-500');
      expect(likeButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('should highlight selected "like" button', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} selected="like" />);

      const likeButton = screen.getByTestId('feedback-like');
      expect(likeButton.className).toContain('border-blue-500');
      expect(likeButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should highlight selected "meh" button', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} selected="meh" />);

      const mehButton = screen.getByTestId('feedback-meh');
      expect(mehButton.className).toContain('border-blue-500');
      expect(mehButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should not highlight any button when no selection', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      const loveButton = screen.getByTestId('feedback-love');
      const likeButton = screen.getByTestId('feedback-like');
      const mehButton = screen.getByTestId('feedback-meh');

      expect(loveButton.getAttribute('aria-pressed')).toBe('false');
      expect(likeButton.getAttribute('aria-pressed')).toBe('false');
      expect(mehButton.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Interaction', () => {
    it('should call onFeedback with "love" when love button clicked', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      fireEvent.click(screen.getByTestId('feedback-love'));

      expect(onFeedback).toHaveBeenCalledWith('love');
      expect(onFeedback).toHaveBeenCalledTimes(1);
    });

    it('should call onFeedback with "like" when like button clicked', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      fireEvent.click(screen.getByTestId('feedback-like'));

      expect(onFeedback).toHaveBeenCalledWith('like');
    });

    it('should call onFeedback with "meh" when meh button clicked', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      fireEvent.click(screen.getByTestId('feedback-meh'));

      expect(onFeedback).toHaveBeenCalledWith('meh');
    });

    it('should allow changing selection by clicking different button', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} selected="love" />);

      fireEvent.click(screen.getByTestId('feedback-meh'));

      expect(onFeedback).toHaveBeenCalledWith('meh');
    });
  });

  describe('Disabled state', () => {
    it('should not call onFeedback when disabled', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} disabled />);

      fireEvent.click(screen.getByTestId('feedback-love'));
      fireEvent.click(screen.getByTestId('feedback-like'));
      fireEvent.click(screen.getByTestId('feedback-meh'));

      expect(onFeedback).not.toHaveBeenCalled();
    });

    it('should apply disabled styling', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} disabled />);

      const button = screen.getByTestId('feedback-love');
      expect(button.className).toContain('opacity-50');
      expect(button.className).toContain('cursor-not-allowed');
    });

    it('should set disabled attribute on buttons', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} disabled />);

      expect(screen.getByTestId('feedback-love').hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('feedback-like').hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('feedback-meh').hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on each button', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      expect(screen.getByTestId('feedback-love').getAttribute('aria-label')).toBe('Love it!');
      expect(screen.getByTestId('feedback-like').getAttribute('aria-label')).toBe('Good');
      expect(screen.getByTestId('feedback-meh').getAttribute('aria-label')).toBe('Meh');
    });

    it('should have title attributes for tooltips', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      expect(screen.getByTestId('feedback-love').getAttribute('title')).toBe('Love it!');
      expect(screen.getByTestId('feedback-like').getAttribute('title')).toBe('Good');
      expect(screen.getByTestId('feedback-meh').getAttribute('title')).toBe('Meh');
    });

    it('should have aria-pressed attribute', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} selected="like" />);

      expect(screen.getByTestId('feedback-love').getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByTestId('feedback-like').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('feedback-meh').getAttribute('aria-pressed')).toBe('false');
    });

    it('should hide emoji from screen readers', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} />);

      const button = screen.getByTestId('feedback-love');
      const emojiSpan = button.querySelector('span[role="img"]');
      expect(emojiSpan?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to container', () => {
      const onFeedback = vi.fn();
      render(<FeedbackButtons onFeedback={onFeedback} className="mt-4 custom-class" />);

      const container = screen.getByTestId('feedback-buttons');
      expect(container.className).toContain('mt-4');
      expect(container.className).toContain('custom-class');
    });
  });
});
