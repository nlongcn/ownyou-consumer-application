# Sprint 11: Consumer UI (Full Implementation)

**Duration:** 4 weeks
**Status:** PLANNED
**Goal:** Implement production-ready consumer interface from Figma designs with full component library, responsive layouts, and platform adaptations (PWA + Tauri Desktop)
**Success Criteria:** All 11 card types implemented, navigation working (mobile + desktop), Ikigai wheel visualization, settings screens complete, PWA and Tauri builds working
**Depends On:** Sprint 10 complete (Cross-Device Sync)
**v13 Coverage:** Section 4 (Complete Consumer UI)
**Target Tests:** 200+ (components: 120+, integration: 50+, e2e: 30+)

---

## Previous Sprint Summary

### Sprint 10: Cross-Device Sync (COMPLETE)

- `@ownyou/sync` — OrbitDB v3 + Helia, CRDT conflict resolution, offline queue (263 tests)
- `@ownyou/backup` — E2EE cloud backup with Signal-style encryption (58 tests)
- `@ownyou/discovery` — Wallet-based device discovery, key derivation (28 tests)
- `@ownyou/debug-ui` — SyncMonitor connected to real sync data (34 tests)
- Total: 383 tests

**Current State:**

- 6 agents operational (Shopping, Content, Restaurant, Events, Travel, Diagnostic)
- 4 data sources operational (Email, Financial, Calendar, Browser)
- Memory system with hybrid retrieval and reflection
- 4-mode trigger system with agent coordinator
- Ikigai intelligence layer for personalization
- Production-ready observability and debugging
- Cross-device sync with E2EE backup
- **Basic UI components** — MissionCard, MissionFeed, FeedbackButtons (Sprint 3)
- **Missing:** Full consumer UI, navigation shell, all card variants, profile/settings screens

---

## Sprint 11 Overview

```
+------------------------------------------------------------------+
|                     SPRINT 11 END STATE                           |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: SHELL & NAVIGATION                                       |
|  +----------------------------------------------------------+     |
|  | [Implement design system tokens (colors, typography)]     |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build Shell component with sky blue background]         |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Create Header with logo, filter tabs, token balance]    |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build Bottom Navigation (mobile) / Sidebar (desktop)]   |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: ALL CARD VARIANTS                                        |
|  +----------------------------------------------------------+     |
|  | [Refactor MissionCard base with Figma-spec styling]      |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement 11 card type variants (shopping, savings,     |     |
|  |  travel, entertainment, food, people, health, etc.)]     |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build masonry grid feed with react-masonry-css]         |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement FeedbackHeart (grey→red→large red cycle)]     |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 3: PROFILE & SETTINGS                                       |
|  +----------------------------------------------------------+     |
|  | [Build IkigaiWheel 4-dimension visualization]            |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement IABCategories breakdown display]              |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Create Settings screens (privacy, data, wallet)]        |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build data connection cards with sync status]           |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 4: POLISH & PLATFORM ADAPTATIONS                            |
|  +----------------------------------------------------------+     |
|  | [PWA optimization (service worker, offline)]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Desktop breakpoints (1024/1280/1440/1920+)]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Keyboard navigation (J/K, Enter, Esc)]                  |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Card hover actions, responsive image loading]           |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  PRODUCTION-READY CONSUMER UI                                     |
|  PWA + TAURI DESKTOP WITH 95% SHARED CODE                         |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections: v13 Section 4 (Consumer UI Implementation)

| v13 Section | Requirement | Sprint 11 Implementation | Priority |
|-------------|-------------|-------------------------|----------|
| **4.1** | Figma Designs Complete | Use OwnYou May-25 Mockup as source | P0 |
| **4.2** | Implementation Phases (UI-1 to UI-5) | All phases in this sprint | P0 |
| **4.3.1** | Color Palette | CSS custom properties with tokens | P0 |
| **4.3.2** | Typography | Life Savers, Alata, SF Pro fonts | P0 |
| **4.3.3** | Spacing & Layout | 35px card radius, 180px width | P0 |
| **4.4** | Component Library | Full implementation | P0 |
| **4.5** | Mission Card Specifications | 11 card types, anatomy, feedback | P0 |
| **4.6** | Navigation Components | Header, bottom nav, sidebar | P0 |
| **4.7** | Feed Layout | Masonry grid, 2-column mobile | P0 |
| **4.8** | Platform Adaptations | PWA mobile + Tauri desktop | P0 |
| **4.9** | Asset Management | Image variants, placeholders | P1 |
| **4.10** | Implementation Priority | Follow P0→P1→P2→P3 order | P0 |

### Already Complete (from previous sprints)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **4.4 partial** | MissionCard base, MissionFeed, FeedbackButtons | ✅ Sprint 3 |
| **4.5.3 partial** | FeedbackButtons (thumbs up/down) | ✅ Sprint 3 (needs upgrade to heart) |

---

## Package Specifications

### Package 1: `@ownyou/ui-design-system`

**Purpose:** Design tokens, theme provider, and shared primitives from v13 Section 4.3

**Dependencies:**
- `tailwindcss` (^3.x) — Utility-first CSS framework
- `@radix-ui/react-slot` — Polymorphic component support
- `class-variance-authority` — Variant management
- `clsx` + `tailwind-merge` — Class name utilities

**Directory Structure:**
```
packages/ui-design-system/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── index.ts
│   ├── tokens/
│   │   ├── colors.ts              # --color-primary, etc.
│   │   ├── typography.ts          # Font family, size, weight
│   │   ├── spacing.ts             # Card radius, gaps, padding
│   │   └── index.ts
│   ├── primitives/
│   │   ├── Button.tsx             # Base button with variants
│   │   ├── Card.tsx               # 35px radius base card
│   │   ├── Modal.tsx              # Overlay modal
│   │   ├── Toast.tsx              # Notification toast
│   │   └── index.ts
│   ├── theme/
│   │   ├── ThemeProvider.tsx      # CSS variable injection
│   │   └── useTheme.ts
│   └── utils/
│       ├── cn.ts                  # clsx + tailwind-merge
│       └── index.ts
└── __tests__/
    ├── tokens.test.ts
    └── primitives/
        ├── Button.test.tsx
        └── Card.test.tsx
```

#### Design Tokens (from v13 Section 4.3)

```typescript
// src/tokens/colors.ts
export const colors = {
  primary: '#87CEEB',        // Sky Blue - app background
  secondary: '#70DF82',      // Mint Green - savings, success
  cardBg: '#FFFBFB',         // Off-white - card backgrounds
  cardBgAlt: '#F4F5F7',      // Light gray - utility cards
  textPrimary: '#000000',    // Primary text
  textSecondary: '#FFFBFB',  // Text on colored backgrounds
  placeholder: '#D9D9D9',    // Image placeholders
} as const;

export const colorTokens = {
  '--color-primary': colors.primary,
  '--color-secondary': colors.secondary,
  '--color-card-bg': colors.cardBg,
  '--color-card-bg-alt': colors.cardBgAlt,
  '--color-text-primary': colors.textPrimary,
  '--color-text-secondary': colors.textSecondary,
  '--color-placeholder': colors.placeholder,
} as const;
```

```typescript
// src/tokens/typography.ts
export const typography = {
  display: {
    fontFamily: '"Life Savers", sans-serif',
    fontSize: '16px',
    fontWeight: 700,
  },
  body: {
    fontFamily: '"Life Savers", sans-serif',
    fontSize: '12px',
    fontWeight: 700,
  },
  label: {
    fontFamily: '"Life Savers", sans-serif',
    fontSize: '11px',
    fontWeight: 700,
  },
  price: {
    fontFamily: '"Alata", sans-serif',
    fontSize: '11px',
    fontWeight: 400,
  },
  brand: {
    fontFamily: '"Lohit Tamil", "Lohit Bengali", "Noto Sans", sans-serif',
    fontSize: '13px',
    fontWeight: 400,
  },
  system: {
    fontFamily: '"SF Pro", sans-serif',
    fontSize: '17px',
    fontWeight: 600,
  },
} as const;
```

```typescript
// src/tokens/spacing.ts
export const spacing = {
  radiusCard: '35px',
  radiusCardSmall: '20px',
  radiusImage: '12px',
  radiusImageLarge: '21px',
  radiusNav: '12.5px',
  cardWidth: '180px',
  cardWidthDesktop: '260px',
  cardGap: '13px',
  feedPadding: '10px',
} as const;
```

**Success Criteria:**
- [ ] All v13 4.3 tokens defined as CSS custom properties
- [ ] ThemeProvider injects tokens at root
- [ ] Tailwind config extended with OwnYou tokens
- [ ] Primitives (Button, Card, Modal, Toast) implemented
- [ ] 30+ tests passing

---

### Package 2: `@ownyou/ui-components` (Enhanced)

**Purpose:** Complete component library from v13 Section 4.4 (extends existing Sprint 3 components)

**Dependencies:**
- `@ownyou/ui-design-system` (design tokens)
- `@ownyou/shared-types` (namespaces, mission types)
- `react-masonry-css` or `@tanstack/react-virtual` — Masonry layout
- `framer-motion` — Animations (optional)

**Directory Structure:**
```
packages/ui-components/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   │
│   ├── layout/
│   │   ├── Shell.tsx              # Main app wrapper with sky blue bg
│   │   ├── Header.tsx             # Logo + filter tabs + token balance
│   │   ├── Navigation.tsx         # Bottom nav (mobile) / Sidebar (desktop)
│   │   ├── FilterTabs.tsx         # "All | Savings | Ikigai | Health"
│   │   ├── StatusBar.tsx          # iOS-style status bar (PWA only)
│   │   └── index.ts
│   │
│   ├── mission/
│   │   ├── MissionCard.tsx        # Base card (refactored)
│   │   ├── variants/
│   │   │   ├── MissionCardShopping.tsx
│   │   │   ├── MissionCardSavings.tsx
│   │   │   ├── MissionCardConsumables.tsx
│   │   │   ├── MissionCardContent.tsx
│   │   │   ├── MissionCardTravel.tsx
│   │   │   ├── MissionCardEntertainment.tsx
│   │   │   ├── MissionCardFood.tsx
│   │   │   ├── MissionCardPeople.tsx
│   │   │   ├── MissionCardHealth.tsx
│   │   │   └── index.ts
│   │   ├── MissionFeed.tsx        # Masonry grid layout
│   │   ├── MissionDetail.tsx      # Expanded mission view
│   │   ├── FeedbackHeart.tsx      # Heart feedback (🩶→❤️→❤️large)
│   │   └── index.ts
│   │
│   ├── branding/
│   │   ├── OwnYouLogo.tsx
│   │   ├── TokenBalance.tsx
│   │   ├── BrandLogo.tsx
│   │   └── index.ts
│   │
│   ├── profile/
│   │   ├── IkigaiWheel.tsx        # Four-dimension visualization
│   │   ├── IABCategories.tsx      # Category breakdown
│   │   ├── ConfidenceGauge.tsx
│   │   ├── EvidenceChain.tsx
│   │   └── index.ts
│   │
│   ├── data/
│   │   ├── ConnectionCard.tsx     # Data source connection status
│   │   ├── OAuthFlow.tsx
│   │   ├── SyncStatus.tsx
│   │   └── index.ts
│   │
│   ├── wallet/
│   │   ├── EarningsDisplay.tsx
│   │   ├── TransactionHistory.tsx
│   │   ├── WithdrawFlow.tsx
│   │   └── index.ts
│   │
│   └── shared/
│       ├── PriceDisplay.tsx       # Price with strikethrough
│       ├── ImagePlaceholder.tsx   # D9D9D9 placeholder
│       └── index.ts
│
└── __tests__/
    ├── layout/
    │   ├── Shell.test.tsx
    │   ├── Header.test.tsx
    │   └── Navigation.test.tsx
    ├── mission/
    │   ├── MissionCard.test.tsx
    │   ├── variants/*.test.tsx
    │   ├── MissionFeed.test.tsx
    │   └── FeedbackHeart.test.tsx
    ├── profile/
    │   ├── IkigaiWheel.test.tsx
    │   └── IABCategories.test.tsx
    └── integration/
        └── navigation-flow.test.tsx
```

#### Mission Card Types (from v13 Section 4.5.1)

```typescript
// src/mission/types.ts
export type MissionCardType =
  | 'shopping'           // home_card_savings_shopping - Product recommendations
  | 'savings'            // home_card_savings_utility - Energy/utility savings
  | 'consumables'        // home_card_savings_consumables - Shopping list
  | 'content'            // home_card_ikigai_content - Podcast/article
  | 'travel'             // home_card_ikigai_travel - Holiday suggestions
  | 'entertainment'      // home_card_ikigai_entertainment - Comedy/theater
  | 'food'               // home_card_ikigai_food_recipe - Dinner ideas
  | 'people'             // home_card_ikigai_people - Relationship suggestions
  | 'health';            // home_health_card_small - Health/longevity

export interface MissionCardDimensions {
  type: MissionCardType;
  height: number;  // px
  hasImage: boolean;
  hasBrandLogo: boolean;
  hasPrice: boolean;
}

export const CARD_DIMENSIONS: Record<MissionCardType, MissionCardDimensions> = {
  shopping: { type: 'shopping', height: 290, hasImage: true, hasBrandLogo: true, hasPrice: true },
  savings: { type: 'savings', height: 284, hasImage: true, hasBrandLogo: true, hasPrice: false },
  consumables: { type: 'consumables', height: 284, hasImage: true, hasBrandLogo: false, hasPrice: false },
  content: { type: 'content', height: 284, hasImage: true, hasBrandLogo: true, hasPrice: false },
  travel: { type: 'travel', height: 208, hasImage: true, hasBrandLogo: false, hasPrice: false },
  entertainment: { type: 'entertainment', height: 207, hasImage: true, hasBrandLogo: false, hasPrice: false },
  food: { type: 'food', height: 287, hasImage: true, hasBrandLogo: false, hasPrice: false },
  people: { type: 'people', height: 210, hasImage: true, hasBrandLogo: false, hasPrice: false },
  health: { type: 'health', height: 180, hasImage: true, hasBrandLogo: false, hasPrice: false },
};
```

#### FeedbackHeart Component (from v13 Section 4.5.3)

```typescript
// src/mission/FeedbackHeart.tsx
import { useState } from 'react';
import { cn } from '@ownyou/ui-design-system';

export type HeartState = 'meh' | 'like' | 'love';

export interface FeedbackHeartProps {
  initialState?: HeartState;
  size?: 'small' | 'default';
  onStateChange?: (state: HeartState) => void;
}

const HEART_CYCLE: HeartState[] = ['meh', 'like', 'love'];

export function FeedbackHeart({
  initialState = 'meh',
  size = 'default',
  onStateChange,
}: FeedbackHeartProps) {
  const [state, setState] = useState<HeartState>(initialState);

  const handleTap = () => {
    const currentIndex = HEART_CYCLE.indexOf(state);
    const nextIndex = (currentIndex + 1) % HEART_CYCLE.length;
    const nextState = HEART_CYCLE[nextIndex];
    setState(nextState);
    onStateChange?.(nextState);
  };

  const sizeClasses = size === 'small' ? 'w-6 h-6' : 'w-7 h-7';
  const heartClasses = cn(
    sizeClasses,
    'cursor-pointer transition-all duration-200',
    state === 'meh' && 'text-gray-400',
    state === 'like' && 'text-red-500',
    state === 'love' && 'text-red-500 scale-125',
  );

  return (
    <button
      onClick={handleTap}
      className={heartClasses}
      aria-label={`Feedback: ${state}`}
    >
      {state === 'meh' ? '🩶' : '❤️'}
    </button>
  );
}
```

#### Masonry Feed Layout (from v13 Section 4.7)

```typescript
// src/mission/MissionFeed.tsx
import Masonry from 'react-masonry-css';
import type { MissionCard as MissionCardType } from '@ownyou/shared-types';
import { MissionCard } from './MissionCard';

export interface MissionFeedProps {
  missions: MissionCardType[];
  onMissionClick?: (missionId: string) => void;
  onFeedbackChange?: (missionId: string, state: HeartState) => void;
}

const BREAKPOINT_COLUMNS = {
  default: 4,   // 1920px+
  1440: 4,
  1280: 3,
  1024: 3,
  768: 2,
  640: 2,
};

export function MissionFeed({
  missions,
  onMissionClick,
  onFeedbackChange,
}: MissionFeedProps) {
  return (
    <Masonry
      breakpointCols={BREAKPOINT_COLUMNS}
      className="flex -ml-[13px] w-auto"
      columnClassName="pl-[13px] bg-clip-padding"
    >
      {missions.map((mission) => (
        <div key={mission.id} className="mb-[13px]">
          <MissionCard
            mission={mission}
            onClick={() => onMissionClick?.(mission.id)}
            onFeedbackChange={(state) => onFeedbackChange?.(mission.id, state)}
          />
        </div>
      ))}
    </Masonry>
  );
}
```

**Success Criteria:**
- [ ] All 11 card type variants implemented
- [ ] MissionFeed masonry layout working
- [ ] FeedbackHeart cycles through 🩶→❤️→❤️large
- [ ] Navigation components (Header, BottomNav, Sidebar)
- [ ] Profile components (IkigaiWheel, IABCategories)
- [ ] 90+ tests passing

---

### Package 3: `@ownyou/consumer-app`

**Purpose:** Main consumer application (PWA + Tauri shared codebase)

**Dependencies:**
- `@ownyou/ui-design-system` (tokens)
- `@ownyou/ui-components` (components)
- `@ownyou/shared-types` (namespaces)
- `@ownyou/store` (data access)
- `@ownyou/sync` (cross-device sync)
- `react-router-dom` (routing)
- `@tanstack/react-query` (data fetching)

**Directory Structure:**
```
apps/consumer/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── assets/
│       ├── fonts/
│       │   ├── LifeSavers-Bold.woff2
│       │   ├── Alata-Regular.woff2
│       │   └── ...
│       └── icons/
│           ├── logo-192.png
│           └── logo-512.png
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── index.tsx          # Route definitions
│   │   ├── Home.tsx           # Mission feed
│   │   ├── Profile.tsx        # Ikigai + IAB
│   │   ├── Settings.tsx       # Privacy, data, wallet
│   │   ├── Wallet.tsx         # Earnings + transactions
│   │   └── MissionDetail.tsx  # Expanded mission view
│   ├── hooks/
│   │   ├── useMissions.ts
│   │   ├── useProfile.ts
│   │   ├── useSync.ts
│   │   └── useKeyboardNav.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── SyncContext.tsx
│   └── utils/
│       └── platform.ts        # PWA vs Tauri detection
└── __tests__/
    ├── routes/
    │   ├── Home.test.tsx
    │   └── Profile.test.tsx
    └── e2e/
        ├── navigation.test.ts
        └── mission-interaction.test.ts
```

#### Platform Detection

```typescript
// src/utils/platform.ts
export type Platform = 'pwa' | 'tauri';

export function getPlatform(): Platform {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return 'tauri';
  }
  return 'pwa';
}

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export function getBreakpoint(): 'mobile' | 'tablet' | 'desktop' | 'wide' {
  if (typeof window === 'undefined') return 'mobile';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop';
  return 'wide';
}
```

#### Desktop Breakpoints (from v13 Section 4.8)

| Breakpoint | Columns | Card Width | Sidebar |
|------------|---------|------------|---------|
| < 768px | 2 | 180px | Hidden (bottom nav) |
| 1024px | 3 | 220px | Collapsed icons |
| 1280px | 3 | 260px | Expanded labels |
| 1440px | 4 | 280px | Expanded labels |
| 1920px+ | 4-5 | 300px | Expanded labels |

**Success Criteria:**
- [ ] PWA builds and runs with service worker
- [ ] Tauri builds and runs with native window
- [ ] Responsive breakpoints working
- [ ] Keyboard navigation (J/K, Enter, Esc)
- [ ] 50+ tests passing

---

## Implementation Requirements

### From Previous Sprint Lessons Learned (MANDATORY)

#### C1: Namespace Usage
```typescript
// ❌ NEVER do this
const feedbackNs = 'ownyou.missions.feedback';

// ✅ ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
const feedbackNs = NS.missionsFeedback(userId);
```

#### C2: Store Writes for Feedback
```typescript
// ❌ NEVER do this - conditional writes
if (state !== 'meh') {
  await store.put(NS.missionsFeedback(userId), missionId, { state });
}

// ✅ ALWAYS write, including 'meh' state
await store.put(NS.missionsFeedback(userId), missionId, {
  state,
  timestamp: Date.now(),
  source: 'explicit_tap',
});
```

#### I1: Extract Magic Numbers to Config
```typescript
// ❌ NEVER do this
const cardWidth = 180;
const cardGap = 13;

// ✅ Use design tokens
import { spacing } from '@ownyou/ui-design-system';
const cardWidth = spacing.cardWidth;   // '180px'
const cardGap = spacing.cardGap;       // '13px'
```

#### I2: Component Testing Patterns
```typescript
// ❌ Anti-pattern: Shallow render without user interaction
render(<MissionCard mission={mockMission} />);
expect(screen.getByText('Title')).toBeInTheDocument();

// ✅ Pattern: Test user interactions and state changes
render(<MissionCard mission={mockMission} onFeedbackChange={mockCallback} />);
const heart = screen.getByRole('button', { name: /feedback/i });

// Simulate tap cycle: meh → like
await userEvent.click(heart);
expect(mockCallback).toHaveBeenCalledWith('like');

// like → love
await userEvent.click(heart);
expect(mockCallback).toHaveBeenCalledWith('love');
```

### Component Testing Requirements

| Component Type | Required Tests | Focus Areas |
|----------------|----------------|-------------|
| Design tokens | 10+ | Token values, CSS variable injection |
| Primitives | 15+ | Variants, accessibility, keyboard |
| Layout | 20+ | Responsive, mobile/desktop |
| Mission cards | 30+ | All 11 variants, feedback, click |
| Profile | 15+ | Ikigai wheel, IAB categories |
| Integration | 20+ | Navigation flow, data loading |
| E2E | 10+ | User journeys, platform specific |

---

## Week-by-Week Breakdown

### Week 1: Shell & Navigation (Days 1-5)

**Day 1-2: Design System Package**
- [ ] Create `@ownyou/ui-design-system` package
- [ ] Define color, typography, spacing tokens
- [ ] Create ThemeProvider with CSS variable injection
- [ ] Configure Tailwind with OwnYou tokens
- [ ] Implement primitives: Button, Card, Modal, Toast

**Day 3: Shell & Header**
- [ ] Build Shell component with sky blue background
- [ ] Create Header with OwnYou logo
- [ ] Implement FilterTabs (All | Savings | Ikigai | Health)
- [ ] Add TokenBalance display

**Day 4-5: Navigation**
- [ ] Build BottomNavigation for mobile (5 icons)
- [ ] Build SidebarNavigation for desktop
- [ ] Implement responsive navigation switching
- [ ] Add route transitions
- [ ] Write unit tests (target: 35+ tests)

### Week 2: All Card Variants (Days 6-10)

**Day 6-7: Base Card Refactor**
- [ ] Refactor MissionCard with Figma-spec styling
- [ ] Add 35px radius, proper typography
- [ ] Implement card anatomy (image, brand, title, price)
- [ ] Replace FeedbackButtons with FeedbackHeart

**Day 8-9: Card Variants**
- [ ] Implement MissionCardShopping (product, brand, price)
- [ ] Implement MissionCardSavings (utility logos, savings)
- [ ] Implement MissionCardConsumables (grid image)
- [ ] Implement MissionCardContent (podcast/article)
- [ ] Implement MissionCardTravel (full-bleed destination)
- [ ] Implement MissionCardEntertainment (event image)
- [ ] Implement MissionCardFood (food image)
- [ ] Implement MissionCardPeople (person photo)
- [ ] Implement MissionCardHealth (health imagery)

**Day 10: Feed Layout**
- [ ] Implement masonry grid with react-masonry-css
- [ ] Configure breakpoint columns
- [ ] Add loading skeletons (D9D9D9 placeholders)
- [ ] Write unit tests (target: 40+ tests)

### Week 3: Profile & Settings (Days 11-15)

**Day 11-12: Profile Components**
- [ ] Build IkigaiWheel visualization (4 dimensions)
- [ ] Implement dimension scoring display
- [ ] Create IABCategories breakdown
- [ ] Add ConfidenceGauge component

**Day 13-14: Settings Screens**
- [ ] Build Settings layout with sections
- [ ] Implement Privacy controls
- [ ] Create Data management (sources, export)
- [ ] Build ConnectionCard with sync status

**Day 15: Wallet Screens**
- [ ] Implement EarningsDisplay
- [ ] Build TransactionHistory
- [ ] Create WithdrawFlow (mock)
- [ ] Write unit tests (target: 30+ tests)

### Week 4: Polish & Platform Adaptations (Days 16-20)

**Day 16-17: PWA Optimization**
- [ ] Configure service worker for offline
- [ ] Setup PWA manifest
- [ ] Implement offline mission cache
- [ ] Add install prompt

**Day 18: Desktop Adaptations**
- [ ] Implement all breakpoints (1024/1280/1440/1920+)
- [ ] Build CardHoverActions component
- [ ] Add hover states and transitions

**Day 19: Keyboard Navigation**
- [ ] Implement J/K navigation in feed
- [ ] Add Enter to open mission
- [ ] Add Esc to close modal/detail
- [ ] Focus management for accessibility

**Day 20: Final Integration**
- [ ] Connect all components to store
- [ ] Test with real mission data
- [ ] Run full test suite
- [ ] Documentation and cleanup
- [ ] Write integration/e2e tests (target: 25+ tests)

---

## Test Targets

| Package | Target Tests | Focus Areas |
|---------|-------------|-------------|
| `@ownyou/ui-design-system` | 30+ | Tokens, ThemeProvider, primitives |
| `@ownyou/ui-components` | 90+ | All components, variants, interactions |
| `@ownyou/consumer-app` | 50+ | Routes, hooks, contexts |
| Integration tests | 20+ | Navigation flow, data loading |
| E2E tests | 10+ | User journeys |
| **Total** | **200+** | |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | >80% for all packages |
| Lighthouse PWA score | >90 |
| First Contentful Paint | <1.5s |
| Time to Interactive | <3s |
| All 11 card types | Implemented with tests |
| Responsive breakpoints | 5 (mobile, tablet, desktop, wide, ultra-wide) |
| Keyboard navigation | J/K, Enter, Esc, Tab |
| Accessibility | WCAG 2.1 AA |

---

## Dependencies and External Services

### NPM Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.4 | Utility-first CSS |
| `react-masonry-css` | ^1.0 | Masonry grid layout |
| `@radix-ui/react-*` | ^1.0 | Accessible primitives |
| `class-variance-authority` | ^0.7 | Variant management |
| `clsx` | ^2.0 | Class name utility |
| `tailwind-merge` | ^2.0 | Tailwind class merging |
| `framer-motion` | ^10.0 | Animations (optional) |
| `@tanstack/react-query` | ^5.0 | Data fetching |
| `react-router-dom` | ^6.0 | Routing |

### Figma Assets

| Asset | Source | Purpose |
|-------|--------|---------|
| OwnYou Logo | Figma `img9` | Header, splash |
| Navigation Icons | Figma `img3-6` | Bottom/sidebar nav |
| Feedback Heart | Figma `imgProperty1Default` | Card feedback |
| Card Images | Figma MCP | Product/content images |

### Fonts (from v13 Section 4.3.2)

| Font | Source | Usage |
|------|--------|-------|
| Life Savers | Google Fonts | Display, body, labels |
| Alata | Google Fonts | Prices |
| SF Pro | System (iOS/macOS) | System text |
| Lohit Tamil/Bengali | Google Fonts | Brand names |

---

## Key Architectural Decisions

### 1. Shared Component Library (95% Code Sharing)

**Decision:** Single `@ownyou/ui-components` package for PWA and Tauri.

**Rationale:**
- Avoid maintaining two UI codebases
- Consistent user experience across platforms
- Platform-specific code isolated to 5% (auth, notifications, native APIs)

### 2. Design Tokens over Hardcoded Values

**Decision:** All styling through CSS custom properties and Tailwind config.

**Rationale:**
- Single source of truth for design decisions
- Easy theme updates
- Consistent with v13 Section 4.3 specifications

### 3. react-masonry-css for Layout

**Decision:** Use react-masonry-css over CSS Grid masonry (not yet supported).

**Rationale:**
- CSS Grid masonry is experimental (limited browser support)
- react-masonry-css is lightweight (~3KB)
- Handles variable height cards correctly

### 4. Heart Feedback over Thumbs

**Decision:** Replace thumbs up/down with heart state cycle.

**Rationale:**
- v13 Section 4.5.3 specifies heart-based feedback
- Three states (meh/like/love) provide more granular signals
- Implicit feedback from engagement complements explicit taps

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/ui-design-system/package.json` | Package config |
| `packages/ui-design-system/src/tokens/*.ts` | Design tokens |
| `packages/ui-design-system/src/primitives/*.tsx` | Base components |
| `packages/ui-design-system/src/theme/*.tsx` | Theme provider |
| `packages/ui-components/src/layout/*.tsx` | Navigation, shell |
| `packages/ui-components/src/mission/variants/*.tsx` | Card variants |
| `packages/ui-components/src/profile/*.tsx` | Profile components |
| `packages/ui-components/src/wallet/*.tsx` | Wallet components |
| `apps/consumer/package.json` | Consumer app config |
| `apps/consumer/src/routes/*.tsx` | App routes |
| `apps/consumer/public/manifest.json` | PWA manifest |

### Modified Files

| File | Change |
|------|--------|
| `packages/ui-components/src/MissionCard.tsx` | Refactor with Figma styling |
| `packages/ui-components/src/MissionFeed.tsx` | Add masonry layout |
| `packages/ui-components/src/FeedbackButtons.tsx` | Replace with FeedbackHeart |
| `packages/shared-types/src/namespaces.ts` | Add UI-related namespaces if needed |

---

## Namespace Updates

```typescript
// Add to @ownyou/shared-types/namespaces.ts if not present
export const NAMESPACES = {
  // ... existing namespaces ...

  // UI State
  UI_PREFERENCES: 'ownyou.ui.preferences',
  UI_FILTER_STATE: 'ownyou.ui.filterState',

  // Feedback (may already exist)
  MISSIONS_FEEDBACK: 'ownyou.missions.feedback',
};

export const NS = {
  // ... existing factory functions ...

  uiPreferences: (userId: string) => [NAMESPACES.UI_PREFERENCES, userId] as const,
  uiFilterState: (userId: string) => [NAMESPACES.UI_FILTER_STATE, userId] as const,
};
```

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Figma asset URLs expire (7-day) | High | Medium | Download and bundle assets at build time |
| Custom fonts increase bundle size | Medium | Low | Use font subsetting, lazy load non-critical |
| Masonry layout performance | Low | Medium | Virtualize with @tanstack/react-virtual if needed |
| iOS PWA limitations | Medium | Medium | Use Tauri for full functionality on desktop |
| Accessibility gaps | Medium | High | Use Radix UI primitives, test with screen readers |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-12-09 | Initial Sprint 11 specification |

---

**Document Status:** Sprint 11 Specification v1 - PLANNED
**Date:** 2025-12-09
**Validates Against:** OwnYou_architecture_v13.md (Section 4)
**Previous Sprint:** Sprint 10 (Cross-Device Sync) ✅ COMPLETE
**Next Sprint:** Sprint 12 (BBS+ & Publisher/Advertiser SDK)
