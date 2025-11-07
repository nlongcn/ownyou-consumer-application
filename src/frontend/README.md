# Frontend Module

**Purpose:** React-based user interface for OwnYou PWA (Phase 6-7)

## Status

🚧 **Placeholder** - To be implemented in Phase 6: UI Layer

## Planned Structure

```
frontend/
├── components/
│   ├── dashboard/
│   ├── mission-cards/
│   ├── settings/
│   └── auth/
├── hooks/
│   ├── useStore.ts
│   ├── useMissions.ts
│   └── useIABClassifications.ts
├── pages/
└── App.tsx
```

## Technology Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (or CSS-in-JS TBD)
- **React Router** - Navigation (if multi-page)

## Integration Points

- `src/browser/store/` - IndexedDBStore via hooks
- `src/browser/agents/` - Agent invocation via hooks
- `src/shared/types/` - Type definitions

## Design Principles

- **Progressive Disclosure:** Show most important info first
- **Ikigai-Driven:** Focus on life purpose, not engagement tricks
- **Privacy-First:** Clear data controls, export/import capability
