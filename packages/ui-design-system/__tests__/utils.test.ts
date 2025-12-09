/**
 * Utility Function Tests
 */

import { describe, it, expect } from 'vitest';
import { cn } from '../src/utils/cn';

describe('cn - class name utility', () => {
  it('should merge simple class strings', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', isActive && 'active', isDisabled && 'disabled');
    expect(result).toBe('base active');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['foo', 'bar'], 'baz');
    expect(result).toBe('foo bar baz');
  });

  it('should handle object syntax', () => {
    const result = cn({
      foo: true,
      bar: false,
      baz: true,
    });
    expect(result).toBe('foo baz');
  });

  it('should merge Tailwind classes correctly (last wins)', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });

  it('should handle color conflicts', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('should handle spacing conflicts', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('should handle margin conflicts', () => {
    const result = cn('m-2 mt-4', 'm-6');
    expect(result).toBe('m-6');
  });

  it('should preserve non-conflicting classes', () => {
    const result = cn('text-lg font-bold', 'text-red-500');
    expect(result).toBe('text-lg font-bold text-red-500');
  });

  it('should handle undefined values', () => {
    const result = cn('foo', undefined, 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle null values', () => {
    const result = cn('foo', null, 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle empty strings', () => {
    const result = cn('foo', '', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle complex variant patterns', () => {
    const variant = 'primary';
    const size = 'lg';
    const result = cn(
      'base-class',
      variant === 'primary' && 'bg-blue-500',
      size === 'lg' && 'text-lg p-4'
    );
    expect(result).toBe('base-class bg-blue-500 text-lg p-4');
  });

  it('should handle responsive prefixes', () => {
    const result = cn('hidden', 'sm:block', 'md:flex');
    expect(result).toBe('hidden sm:block md:flex');
  });

  it('should handle hover states', () => {
    const result = cn('bg-white', 'hover:bg-gray-100');
    expect(result).toBe('bg-white hover:bg-gray-100');
  });
});
