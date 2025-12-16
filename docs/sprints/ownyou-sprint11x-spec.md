# Sprint 11c: Data Connection UX Improvements

**Duration:** 1 week
**Status:** PLANNED
**Goal:** Make the data connection flow clear, visible, and trustworthy so users always know what's happening, where to see results, and how to recover from errors
**Success Criteria:** User can connect a data source and confidently understand the entire process from OAuth to mission generation
**Depends On:** Sprint 11b (wiring complete - functionality works, UX needs polish)
**v13 Coverage:** Section 4 (Consumer UI), Section 5 (Data Sync), Section 10 (Observability)

---

## Problem Statement

After OAuth completes successfully, users experience:
1. **No visibility into processing** - Only a tiny glowing dot next to the provider name
2. **No guidance on where to see results** - User doesn't know where data goes
3. **No problem visibility** - If something fails, user just sees nothing
4. **Confusion about what's happening** - Is it working? Did it fail? Where do I go?

**Root Cause:** Sprint 11b focused on wiring functionality. The UX feedback is minimal (status dots, small text) and doesn't build user confidence.

---

## Sprint 11c Scope: 3 UX Flows

### Flow 1: Processing Pipeline Visibility

**Current State:**
- Tiny yellow pulsing dot during sync
- No indication of what stage (downloading? classifying? storing?)
- No item count or progress percentage

**Target State:**
```
Outlook - Syncing

  Downloading emails    [========>    ] 67%
                        134 of 200 emails

  Next: Classifying interests...
```

**Implementation:**

#### 1.1 Add ProcessingState to DataSourceContext

```typescript
// src/contexts/DataSourceContext.tsx

export interface ProcessingStage {
  id: 'connecting' | 'downloading' | 'classifying' | 'storing' | 'complete';
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

export interface ProcessingProgress {
  sourceId: DataSourceId;
  stages: ProcessingStage[];
  currentStage: ProcessingStage['id'];
  itemsProcessed: number;
  itemsTotal: number;
  startedAt: Date;
  error?: string;
}

// Add to context value
interface DataSourceContextValue {
  // ... existing ...
  processingProgress: Map<DataSourceId, ProcessingProgress>;
}
```

#### 1.2 Update syncSource to Report Progress

```typescript
// DataSourceContext.tsx - syncSource function

const syncSource = useCallback(async (sourceId: DataSourceId): Promise<SyncResult> => {
  // Initialize progress
  updateProgress(sourceId, {
    stages: [
      { id: 'connecting', label: 'Connecting', status: 'complete' },
      { id: 'downloading', label: 'Downloading emails', status: 'active' },
      { id: 'classifying', label: 'Classifying interests', status: 'pending' },
      { id: 'storing', label: 'Saving insights', status: 'pending' },
      { id: 'complete', label: 'Complete', status: 'pending' },
    ],
    currentStage: 'downloading',
    itemsProcessed: 0,
    itemsTotal: 0,
    startedAt: new Date(),
  });

  // During email fetch, update progress
  const result = await pipeline.run(tokenData.accessToken, async (emails) => {
    updateProgress(sourceId, {
      itemsTotal: emails.length,
      currentStage: 'classifying',
      stages: updateStageStatus('downloading', 'complete'),
    });

    // During classification, update per-email
    for (let i = 0; i < emails.length; i++) {
      updateProgress(sourceId, { itemsProcessed: i + 1 });
      // ... classify email ...
    }

    updateProgress(sourceId, {
      currentStage: 'storing',
      stages: updateStageStatus('classifying', 'complete'),
    });

    return results;
  });

  // Mark complete
  updateProgress(sourceId, {
    currentStage: 'complete',
    stages: updateStageStatus('storing', 'complete'),
  });

  return result;
}, [/* deps */]);
```

#### 1.3 Create ProcessingPipeline Component

```typescript
// src/components/ProcessingPipeline.tsx

interface ProcessingPipelineProps {
  sourceId: DataSourceId;
  sourceName: string;
}

export function ProcessingPipeline({ sourceId, sourceName }: ProcessingPipelineProps) {
  const { processingProgress } = useDataSource();
  const progress = processingProgress.get(sourceId);

  if (!progress) return null;

  const currentStage = progress.stages.find(s => s.status === 'active');
  const percentComplete = progress.itemsTotal > 0
    ? Math.round((progress.itemsProcessed / progress.itemsTotal) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <Spinner className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold">{sourceName}</h3>
          <p className="text-sm text-gray-500">Processing your data...</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>{currentStage?.label}</span>
          <span>{percentComplete}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        {progress.itemsTotal > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {progress.itemsProcessed} of {progress.itemsTotal} items
          </p>
        )}
      </div>

      {/* Stage List */}
      <div className="space-y-2">
        {progress.stages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-2 text-sm">
            {stage.status === 'complete' && (
              <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
            )}
            {stage.status === 'active' && (
              <span className="w-5 h-5 bg-blue-500 rounded-full animate-pulse" />
            )}
            {stage.status === 'pending' && (
              <span className="w-5 h-5 bg-gray-200 rounded-full" />
            )}
            {stage.status === 'error' && (
              <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">!</span>
            )}
            <span className={stage.status === 'active' ? 'font-medium' : 'text-gray-500'}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Flow 2: Post-OAuth Guidance

**Current State:**
- Green toast: "Outlook Connected! You can close the browser window"
- No explanation of what happens next
- No navigation guidance

**Target State:**
```
┌─────────────────────────────────────────┐
│  ✓  Connected to Outlook                │
│                                         │
│  We're now processing your data:        │
│  • Downloading recent emails            │
│  • Analyzing your interests             │
│  • Generating personalized missions     │
│                                         │
│  This usually takes 1-2 minutes.        │
│                                         │
│  [View Progress]  [Go to Home]          │
└─────────────────────────────────────────┘
```

**Implementation:**

#### 2.1 Create ConnectionSuccessModal Component

```typescript
// src/components/ConnectionSuccessModal.tsx

interface ConnectionSuccessModalProps {
  sourceName: string;
  sourceId: DataSourceId;
  onViewProgress: () => void;
  onGoHome: () => void;
  onDismiss: () => void;
}

export function ConnectionSuccessModal({
  sourceName,
  sourceId,
  onViewProgress,
  onGoHome,
  onDismiss,
}: ConnectionSuccessModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>

        <h2 className="text-xl font-bold text-center mb-2">
          Connected to {sourceName}!
        </h2>

        <p className="text-gray-600 text-center mb-6">
          We're now processing your data. This usually takes 1-2 minutes.
        </p>

        {/* What's Happening */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="font-medium text-sm mb-2">What we're doing:</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Downloading your recent emails
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full" />
              Analyzing your interests
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full" />
              Generating personalized missions
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onViewProgress}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-full font-medium hover:bg-gray-50"
          >
            View Progress
          </button>
          <button
            onClick={onGoHome}
            className="flex-1 py-3 px-4 bg-ownyou-secondary text-white rounded-full font-medium hover:bg-ownyou-secondary/90"
          >
            Go to Home
          </button>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Stay on this page
        </button>
      </div>
    </div>
  );
}
```

#### 2.2 Update Settings.tsx to Show Modal

```typescript
// Settings.tsx - Replace simple toast with modal

const [showSuccessModal, setShowSuccessModal] = useState<{
  sourceName: string;
  sourceId: DataSourceId;
} | null>(null);

// After OAuth success:
setShowSuccessModal({ sourceName: 'Outlook', sourceId: 'outlook' });

// In render:
{showSuccessModal && (
  <ConnectionSuccessModal
    sourceName={showSuccessModal.sourceName}
    sourceId={showSuccessModal.sourceId}
    onViewProgress={() => {
      setShowSuccessModal(null);
      // Scroll to processing section
    }}
    onGoHome={() => {
      setShowSuccessModal(null);
      navigate('/');
    }}
    onDismiss={() => setShowSuccessModal(null)}
  />
)}
```

---

### Flow 3: Error Recovery

**Current State:**
- Tiny red dot next to provider name
- Small "Connection error" text
- No details, no retry button

**Target State:**
```
┌─────────────────────────────────────────┐
│ ⚠  Outlook Connection Failed            │
│                                         │
│ The connection couldn't be completed:   │
│ "Access token expired"                  │
│                                         │
│ [Try Again]  [Get Help]                 │
└─────────────────────────────────────────┘
```

**Implementation:**

#### 3.1 Create ConnectionErrorCard Component

```typescript
// src/components/ConnectionErrorCard.tsx

interface ConnectionErrorCardProps {
  sourceName: string;
  sourceId: DataSourceId;
  error: string;
  onRetry: () => void;
}

export function ConnectionErrorCard({
  sourceName,
  sourceId,
  error,
  onRetry,
}: ConnectionErrorCardProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-red-600 text-xl">!</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800">
            {sourceName} Connection Failed
          </h3>
          <p className="text-sm text-red-600 mt-1">
            {error || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700"
            >
              Try Again
            </button>
            <a
              href="https://docs.ownyou.ai/troubleshooting"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-red-300 text-red-600 rounded-full text-sm font-medium hover:bg-red-100"
            >
              Get Help
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 3.2 Update DataSourceCard to Show Error Card

```typescript
// Settings.tsx - DataSourceCard

function DataSourceCard({ source, onConnect, onDisconnect, onRetry }: Props) {
  // If error, show error card instead of normal card
  if (source.status === 'error') {
    return (
      <ConnectionErrorCard
        sourceName={getSourceDisplayName(source.id)}
        sourceId={source.id}
        error={source.error || 'Connection failed'}
        onRetry={() => onRetry(source.id)}
      />
    );
  }

  // Normal card rendering...
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/consumer/src/components/ProcessingPipeline.tsx` | Visual pipeline with stages and progress |
| `apps/consumer/src/components/ConnectionSuccessModal.tsx` | Post-OAuth guidance modal |
| `apps/consumer/src/components/ConnectionErrorCard.tsx` | Error display with retry |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/consumer/src/contexts/DataSourceContext.tsx` | Add `ProcessingProgress` state, update `syncSource` to report progress |
| `apps/consumer/src/routes/Settings.tsx` | Use new components, show modal after OAuth, show error cards |

---

## Implementation Order

### Day 1-2: Processing State Infrastructure
- [ ] Add `ProcessingProgress` interface to DataSourceContext
- [ ] Add `processingProgress` state map to context
- [ ] Update `syncSource` to report progress at each stage
- [ ] Add progress callback to EmailPipeline

### Day 3: UI Components
- [ ] Create `ProcessingPipeline` component
- [ ] Create `ConnectionSuccessModal` component
- [ ] Create `ConnectionErrorCard` component

### Day 4: Integration
- [ ] Wire `ProcessingPipeline` into Settings page
- [ ] Replace success toast with `ConnectionSuccessModal`
- [ ] Replace error dot/text with `ConnectionErrorCard`
- [ ] Add retry functionality

### Day 5: Polish & Testing
- [ ] Test full flow: OAuth → Processing → Complete
- [ ] Test error scenarios: network failure, token expiry
- [ ] Responsive design for mobile
- [ ] 15+ tests for new components

---

## Test Targets (15+ Tests)

| Component | Tests | Focus |
|-----------|-------|-------|
| ProcessingPipeline | 5 | Stage rendering, progress bar, completion |
| ConnectionSuccessModal | 4 | Actions, navigation, dismiss |
| ConnectionErrorCard | 4 | Error display, retry, help link |
| DataSourceContext progress | 4 | Progress updates, stage transitions |

---

## Success Criteria

- [ ] User sees clear progress during sync: "Downloading 45/100 emails"
- [ ] User sees stage progression: Connecting → Downloading → Classifying → Complete
- [ ] After OAuth, modal explains what's happening with clear actions
- [ ] Errors show full message with retry button
- [ ] User can confidently answer: "Is it working? What's next?"

---

## Visual Design Notes

### Progress Colors
- Pending: `bg-gray-200`
- Active: `bg-blue-500 animate-pulse`
- Complete: `bg-green-500`
- Error: `bg-red-500`

### Progress Bar Gradient
```css
background: linear-gradient(to right, #3B82F6, #22C55E);
```

### Modal Backdrop
```css
background: rgba(0, 0, 0, 0.5);
backdrop-filter: blur(4px);
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-12-16 | Initial Sprint 11c specification |

---

**Document Status:** Sprint 11c Specification v1 - PLANNED
**Date:** 2025-12-16
**Duration:** 1 week
**Predecessor:** Sprint 11b (functionality wiring)
**Focus:** UX polish for data connection flow
