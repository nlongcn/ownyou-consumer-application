# @ownyou/ui-components

Shared UI components for OwnYou mission cards and feedback.

## v13 Architecture Reference

- **Section 3.4**: Mission Card UI
- **Section 3.5**: User Feedback Loop

## Components

### MissionCard

Displays a mission card with actions.

```tsx
import { MissionCard } from '@ownyou/ui-components';

<MissionCard
  mission={mission}
  onAction={(action) => handleAction(action)}
  onFeedback={(feedback) => handleFeedback(feedback)}
/>
```

### MissionFeed

Displays a list of mission cards with filtering.

```tsx
import { MissionFeed } from '@ownyou/ui-components';

<MissionFeed
  missions={missions}
  filter="active"
  onMissionAction={handleAction}
/>
```

### FeedbackButtons

Inline feedback buttons (love/like/meh).

```tsx
import { FeedbackButtons } from '@ownyou/ui-components';

<FeedbackButtons
  onFeedback={(rating) => saveFeedback(rating)}
  disabled={false}
/>
```

## Styling

Components use TailwindCSS classes and expect Tailwind to be configured in the consuming application.

## Dependencies

- `@ownyou/shared-types` - MissionCard, MissionStatus types
- `react` - Peer dependency
