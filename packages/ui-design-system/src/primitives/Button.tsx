/**
 * Button Primitive - Base button component with variants
 *
 * Uses class-variance-authority for variant management and
 * Radix UI Slot for polymorphic rendering (asChild pattern).
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.4
 */

import React, { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ownyou-primary text-text-primary hover:bg-ownyou-primary/90',
        secondary: 'bg-ownyou-secondary text-text-primary hover:bg-ownyou-secondary/90',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-100',
        ghost: 'hover:bg-gray-100',
        link: 'underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-button',
        md: 'h-10 px-4 text-base rounded-button',
        lg: 'h-12 px-6 text-lg rounded-button',
        icon: 'h-10 w-10 rounded-button',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render as child element (polymorphic component)
   */
  asChild?: boolean;
}

/**
 * Button primitive with variants
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md">Click me</Button>
 *
 * // As a link
 * <Button asChild>
 *   <a href="/contact">Contact</a>
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { buttonVariants };
