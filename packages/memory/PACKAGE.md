# @ownyou/memory

Memory tools, embeddings, and retrieval for OwnYou - v13 Section 8.4-8.7

## Purpose

Provides the memory layer for personal data storage with:
- Memory tools (save, search, invalidate)
- Local embeddings via transformer.js
- Hybrid retrieval (semantic + keyword + entity)
- Memory lifecycle (decay, pruning, consolidation)

## Architecture (v13)

- **Section 8.4**: Memory types with bi-temporal modeling (validAt, invalidAt)
- **Section 8.5**: Local embeddings using nomic-embed-text-v1.5 (768 dimensions)
- **Section 8.7**: Hybrid retrieval with RRF ranking
- **Section 8.9**: Memory lifecycle with 5%/week decay

## Usage

```typescript
import {
  saveObservation,
  saveEpisode,
  searchMemories,
  invalidateMemory,
  retrieveMemories,
  pruneMemories,
} from '@ownyou/memory';

// Save an observation
await saveObservation({
  content: 'User prefers boutique hotels',
  context: 'travel',
  confidence: 0.9,
  sources: ['email:booking_confirmation'],
  store,
  userId,
});

// Search memories
const results = await retrieveMemories({
  query: 'hotel preferences',
  userId,
  store,
  options: { limit: 5, context: 'travel' },
});

// Prune low-value memories
const { pruned, archived } = await pruneMemories(userId, store);
```

## Key Concepts

### Memory Strength
- Starts at 1.0
- Increases with access (+0.1 per access)
- Decays 5% per week without access
- Pruned when strength < 0.1

### Retrieval Modes
1. **Semantic**: Cosine similarity on embeddings
2. **Keyword**: BM25 full-text matching
3. **Entity**: Named entity lookup
4. **RRF**: Reciprocal Rank Fusion combines all

### Bi-temporal Modeling
- `validAt`: When the fact became true
- `invalidAt`: When the fact became false (if updated)
- `createdAt`: When we learned about it

## Tests

```bash
pnpm test  # 65 tests
```
