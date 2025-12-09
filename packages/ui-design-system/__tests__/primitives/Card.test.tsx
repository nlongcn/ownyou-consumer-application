/**
 * Card Primitive Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardImage,
} from '../../src/primitives/Card';

describe('Card', () => {
  it('should render with default props', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toBeInTheDocument();
  });

  it('should apply 35px border radius (rounded-card class)', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('rounded-card');
  });

  it('should apply card background color', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-card-bg');
  });

  it('should render with default variant (shadow-sm)', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('shadow-sm');
  });

  it('should render with elevated variant', () => {
    render(<Card variant="elevated" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('shadow-md');
  });

  it('should render with outline variant', () => {
    render(<Card variant="outline" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('border');
  });

  it('should render with ghost variant', () => {
    render(<Card variant="ghost" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-transparent');
  });

  it('should render with default size (180px)', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('w-card');
  });

  it('should render with desktop size', () => {
    render(<Card size="desktop" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('w-card-desktop');
  });

  it('should render with full width', () => {
    render(<Card size="full" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('w-full');
  });

  it('should render with padding', () => {
    render(<Card padding="md" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('p-4');
  });

  it('should merge custom className', () => {
    render(<Card className="custom-class" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('custom-class');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref}>Ref Card</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardHeader', () => {
  it('should render with default styles', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();
    expect(header.className).toContain('p-3');
  });
});

describe('CardTitle', () => {
  it('should render as h3', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByRole('heading', { level: 3 });
    expect(title).toBeInTheDocument();
    expect(title.textContent).toBe('Title');
  });

  it('should apply display font class', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    const title = screen.getByTestId('title');
    expect(title.className).toContain('font-display');
  });
});

describe('CardDescription', () => {
  it('should render description text', () => {
    render(<CardDescription>Description</CardDescription>);
    const description = screen.getByText('Description');
    expect(description).toBeInTheDocument();
    expect(description.tagName).toBe('P');
  });
});

describe('CardContent', () => {
  it('should render content', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    const content = screen.getByTestId('content');
    expect(content).toBeInTheDocument();
    expect(content.className).toContain('p-3');
  });
});

describe('CardFooter', () => {
  it('should render footer with flex layout', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer.className).toContain('flex');
  });
});

describe('CardImage', () => {
  it('should render image with placeholder background', () => {
    render(<CardImage src="/test.jpg" alt="Test" data-testid="image" />);
    const image = screen.getByTestId('image');
    expect(image.className).toContain('bg-placeholder');
  });

  it('should apply default radius', () => {
    render(<CardImage src="/test.jpg" alt="Test" data-testid="image" />);
    const image = screen.getByTestId('image');
    expect(image.className).toContain('rounded-image');
  });

  it('should apply large radius', () => {
    render(<CardImage src="/test.jpg" alt="Test" radius="large" data-testid="image" />);
    const image = screen.getByTestId('image');
    expect(image.className).toContain('rounded-image-lg');
  });

  it('should cover the container', () => {
    render(<CardImage src="/test.jpg" alt="Test" data-testid="image" />);
    const image = screen.getByTestId('image');
    expect(image.className).toContain('object-cover');
  });
});
