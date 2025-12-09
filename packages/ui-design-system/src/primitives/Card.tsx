/**
 * Card Primitive - Base card component with 35px radius
 *
 * Foundation for all mission card variants. Uses the OwnYou design
 * system tokens for consistent styling across PWA and Tauri.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.4, 4.5
 */

import React, { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const cardVariants = cva(
  // Base styles with 35px radius from v13 Section 4.3.3
  'rounded-card bg-card-bg overflow-hidden',
  {
    variants: {
      variant: {
        default: 'shadow-sm',
        elevated: 'shadow-md',
        outline: 'border border-gray-200',
        ghost: 'bg-transparent',
      },
      size: {
        default: 'w-card', // 180px mobile
        desktop: 'w-card-desktop', // 260px desktop
        full: 'w-full',
      },
      padding: {
        none: 'p-0',
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      padding: 'none',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /**
   * Render as child element (polymorphic component)
   */
  asChild?: boolean;
}

/**
 * Card primitive - foundation for mission cards
 *
 * @example
 * ```tsx
 * <Card variant="default" size="default">
 *   <CardImage src="..." alt="..." />
 *   <CardContent>
 *     <CardTitle>Product Name</CardTitle>
 *     <CardDescription>Description here</CardDescription>
 *   </CardContent>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, padding, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={cn(cardVariants({ variant, size, padding, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header component
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-3', className)}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

/**
 * Card Title component
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-display text-display text-text-primary leading-tight', className)}
    {...props}
  />
));

CardTitle.displayName = 'CardTitle';

/**
 * Card Description component
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('font-display text-body text-gray-600', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

/**
 * Card Content component
 */
export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-3 pt-0', className)} {...props} />
));

CardContent.displayName = 'CardContent';

/**
 * Card Footer component
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-3 pt-0', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';

/**
 * Card Image component with placeholder support
 */
export interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Image radius variant
   */
  radius?: 'default' | 'large' | 'none';
}

export const CardImage = forwardRef<HTMLImageElement, CardImageProps>(
  ({ className, radius = 'default', alt, ...props }, ref) => {
    const radiusClass = {
      default: 'rounded-image',
      large: 'rounded-image-lg',
      none: 'rounded-none',
    }[radius];

    return (
      <img
        ref={ref}
        className={cn('w-full object-cover bg-placeholder', radiusClass, className)}
        alt={alt}
        {...props}
      />
    );
  }
);

CardImage.displayName = 'CardImage';

export { cardVariants };
