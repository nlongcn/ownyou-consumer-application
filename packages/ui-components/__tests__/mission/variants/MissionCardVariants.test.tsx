/**
 * Mission Card Variants Tests
 * v13 Section 4.5.1
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MissionCardShopping,
  MissionCardSavings,
  MissionCardConsumables,
  MissionCardContent,
  MissionCardTravel,
  MissionCardEntertainment,
  MissionCardFood,
  MissionCardPeople,
  MissionCardHealth,
} from '../../../src/mission/variants';
import type { Mission } from '../../../src/types';

const baseMission: Mission = {
  id: 'test-1',
  type: 'shopping',
  title: 'Test Mission',
  imageUrl: 'https://example.com/image.jpg',
  brandName: 'Test Brand',
  brandLogoUrl: 'https://example.com/logo.jpg',
  feedbackState: 'meh',
  createdAt: Date.now(),
};

describe('MissionCardShopping', () => {
  const mission: Mission = { ...baseMission, type: 'shopping', price: 29.99, originalPrice: 49.99 };

  it('should render with shopping card height (290px)', () => {
    render(<MissionCardShopping mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '290px' });
  });

  it('should display price', () => {
    render(<MissionCardShopping mission={mission} />);
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });

  it('should display original price with strikethrough', () => {
    render(<MissionCardShopping mission={mission} />);
    const originalPrice = screen.getByText('$49.99');
    expect(originalPrice.className).toContain('line-through');
  });

  it('should display brand name', () => {
    render(<MissionCardShopping mission={mission} />);
    expect(screen.getByText('Test Brand')).toBeInTheDocument();
  });

  it('should have data-testid with shopping prefix', () => {
    render(<MissionCardShopping mission={mission} />);
    expect(screen.getByTestId('mission-card-shopping-test-1')).toBeInTheDocument();
  });
});

describe('MissionCardSavings', () => {
  const mission: Mission = { ...baseMission, type: 'savings' };

  it('should render with savings card height (284px)', () => {
    render(<MissionCardSavings mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '284px' });
  });

  it('should display savings amount when provided', () => {
    render(<MissionCardSavings mission={mission} savingsAmount={50} />);
    expect(screen.getByText('$50')).toBeInTheDocument();
  });

  it('should display savings period', () => {
    render(<MissionCardSavings mission={mission} savingsAmount={50} savingsPeriod="per year" />);
    expect(screen.getByText('per year')).toBeInTheDocument();
  });

  it('should have mint tint background', () => {
    render(<MissionCardSavings mission={mission} />);
    const card = screen.getByRole('article');
    expect(card.className).toContain('bg-ownyou-secondary/10');
  });
});

describe('MissionCardConsumables', () => {
  const mission: Mission = { ...baseMission, type: 'consumables' };

  it('should render with consumables card height (284px)', () => {
    render(<MissionCardConsumables mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '284px' });
  });

  it('should display item count badge when provided', () => {
    render(<MissionCardConsumables mission={mission} itemCount={5} />);
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });

  it('should render grid of images when multiple provided', () => {
    render(
      <MissionCardConsumables
        mission={mission}
        itemImages={['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg']}
      />
    );
    const images = screen.getAllByRole('img');
    expect(images.length).toBe(4);
  });
});

describe('MissionCardContent', () => {
  const mission: Mission = { ...baseMission, type: 'content' };

  it('should render with content card height (284px)', () => {
    render(<MissionCardContent mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '284px' });
  });

  it('should display content type badge', () => {
    render(<MissionCardContent mission={mission} contentType="podcast" />);
    expect(screen.getByText('podcast')).toBeInTheDocument();
  });

  it('should display duration when provided', () => {
    render(<MissionCardContent mission={mission} duration={15} />);
    expect(screen.getByText('15 min')).toBeInTheDocument();
  });
});

describe('MissionCardTravel', () => {
  const mission: Mission = { ...baseMission, type: 'travel' };

  it('should render with travel card height (208px)', () => {
    render(<MissionCardTravel mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '208px' });
  });

  it('should display destination when provided', () => {
    render(<MissionCardTravel mission={mission} destination="Paris" />);
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('should display dates when provided', () => {
    render(<MissionCardTravel mission={mission} dates="Dec 20-27" />);
    expect(screen.getByText('Dec 20-27')).toBeInTheDocument();
  });

  it('should have full-bleed image with gradient overlay', () => {
    render(<MissionCardTravel mission={mission} />);
    const card = screen.getByRole('article');
    expect(card.querySelector('.bg-gradient-to-t')).toBeInTheDocument();
  });
});

describe('MissionCardEntertainment', () => {
  const mission: Mission = { ...baseMission, type: 'entertainment' };

  it('should render with entertainment card height (207px)', () => {
    render(<MissionCardEntertainment mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '207px' });
  });

  it('should display event type badge', () => {
    render(<MissionCardEntertainment mission={mission} eventType="comedy" />);
    expect(screen.getByText('comedy')).toBeInTheDocument();
  });

  it('should display event date when provided', () => {
    render(<MissionCardEntertainment mission={mission} eventDate="Sat 7pm" />);
    expect(screen.getByText('Sat 7pm')).toBeInTheDocument();
  });

  it('should display venue when provided', () => {
    render(<MissionCardEntertainment mission={mission} venue="Comedy Club" />);
    expect(screen.getByText('Comedy Club')).toBeInTheDocument();
  });
});

describe('MissionCardFood', () => {
  const mission: Mission = { ...baseMission, type: 'food' };

  it('should render with food card height (287px)', () => {
    render(<MissionCardFood mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '287px' });
  });

  it('should display total time badge', () => {
    render(<MissionCardFood mission={mission} prepTime={15} cookTime={30} />);
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('should display difficulty badge', () => {
    render(<MissionCardFood mission={mission} difficulty="easy" />);
    expect(screen.getByText('easy')).toBeInTheDocument();
  });

  it('should display dietary tags', () => {
    render(<MissionCardFood mission={mission} dietaryTags={['Vegan', 'Gluten-Free']} />);
    expect(screen.getByText('Vegan')).toBeInTheDocument();
    expect(screen.getByText('Gluten-Free')).toBeInTheDocument();
  });
});

describe('MissionCardPeople', () => {
  const mission: Mission = { ...baseMission, type: 'people' };

  it('should render with people card height (210px)', () => {
    render(<MissionCardPeople mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '210px' });
  });

  it('should display relationship type badge', () => {
    render(<MissionCardPeople mission={mission} relationshipType="friend" />);
    expect(screen.getByText(/friend/)).toBeInTheDocument();
  });

  it('should display last interaction', () => {
    render(<MissionCardPeople mission={mission} lastInteraction="2 weeks ago" />);
    expect(screen.getByText('Last seen: 2 weeks ago')).toBeInTheDocument();
  });

  it('should display suggested action', () => {
    render(<MissionCardPeople mission={mission} suggestedAction="Send a message" />);
    expect(screen.getByText('💡 Send a message')).toBeInTheDocument();
  });
});

describe('MissionCardHealth', () => {
  const mission: Mission = { ...baseMission, type: 'health' };

  it('should render with health card height (180px)', () => {
    render(<MissionCardHealth mission={mission} />);
    const card = screen.getByRole('article');
    expect(card).toHaveStyle({ height: '180px' });
  });

  it('should display category badge', () => {
    render(<MissionCardHealth mission={mission} category="exercise" />);
    expect(screen.getByText('exercise')).toBeInTheDocument();
  });

  it('should display progress bar when progress provided', () => {
    render(<MissionCardHealth mission={mission} progress={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should display goal when no progress', () => {
    render(<MissionCardHealth mission={mission} goal="10,000 steps" />);
    expect(screen.getByText('🎯 10,000 steps')).toBeInTheDocument();
  });
});

describe('All Card Variants - Common Behavior', () => {
  const variants = [
    { Component: MissionCardShopping, type: 'shopping' },
    { Component: MissionCardSavings, type: 'savings' },
    { Component: MissionCardConsumables, type: 'consumables' },
    { Component: MissionCardContent, type: 'content' },
    { Component: MissionCardTravel, type: 'travel' },
    { Component: MissionCardEntertainment, type: 'entertainment' },
    { Component: MissionCardFood, type: 'food' },
    { Component: MissionCardPeople, type: 'people' },
    { Component: MissionCardHealth, type: 'health' },
  ] as const;

  variants.forEach(({ Component, type }) => {
    describe(`${type} card`, () => {
      const mission: Mission = { ...baseMission, type };

      it('should call onClick when clicked', () => {
        const handleClick = vi.fn();
        render(<Component mission={mission} onClick={handleClick} />);

        fireEvent.click(screen.getByRole('article'));

        expect(handleClick).toHaveBeenCalledTimes(1);
      });

      it('should call onFeedbackChange when heart is clicked', () => {
        const handleFeedback = vi.fn();
        render(<Component mission={mission} onFeedbackChange={handleFeedback} />);

        fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

        expect(handleFeedback).toHaveBeenCalledWith('like');
      });

      it('should render feedback heart', () => {
        render(<Component mission={mission} />);
        expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
      });

      it('should render title', () => {
        render(<Component mission={mission} />);
        expect(screen.getByText('Test Mission')).toBeInTheDocument();
      });
    });
  });
});
