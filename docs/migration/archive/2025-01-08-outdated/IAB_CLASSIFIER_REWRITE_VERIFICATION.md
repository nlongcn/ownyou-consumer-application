# IAB Classifier Rewrite Verification

**Date:** 2025-01-07
**Python Source:** `src/email_parser/workflow/graph.py` + `state.py`
**Target:** `src/browser/agents/iab-classifier/` (complete rewrite)

---

## Python Source Structure (What to Port)

### Graph.py - 6 Nodes + 2 Conditionals

**Nodes:**
1. `load_emails` - Load new emails, filter processed
2. `retrieve_profile` - Get existing profile from Store
3. `analyze_all` - Run all 4 analyzers sequentially
4. `reconcile` - Reconcile evidence, update confidence
5. `update_memory` - Persist to Store
6. `advance_email` - Move to next email/batch

**Conditional Edges:**
1. `_check_has_emails_conditional` - After load_emails
   - "has_emails" → retrieve_profile
   - "no_emails" → END

2. `_check_continuation_conditional` - After update_memory
   - "continue" → advance_email
   - "end" → END

**Flow:**
```
START → load_emails → [has_emails?]
                         ↓ yes
                     retrieve_profile
                         ↓
                     analyze_all (runs 4 analyzers)
                         ↓
                     reconcile
                         ↓
                     update_memory → [continue?]
                         ↓ yes         ↓ no
                     advance_email    END
                         ↓
                     retrieve_profile (loop)
```

### State.py - 23 Fields

**Required:**
1. `user_id: string`

**NotRequired (added by nodes):**

**Email Data (load_emails):**
2. `emails: Array<Record<string, any>>`
3. `processed_email_ids: Array<string>`
4. `current_email_index: number` (DEPRECATED)
5. `total_emails: number`

**Batch Processing:**
6. `current_batch_start: number`
7. `batch_size: number`
8. `model_context_window: number`
9. `force_reprocess: boolean`
10. `cost_tracker: any`
11. `tracker: any`
12. `llm_model: string`

**Profile Data (retrieve_profile):**
13. `existing_profile: Record<string, any>`

**Analysis Results (analyzers):**
14. `demographics_results: Array<Record<string, any>>`
15. `household_results: Array<Record<string, any>>`
16. `interests_results: Array<Record<string, any>>`
17. `purchase_results: Array<Record<string, any>>`

**Reconciliation (reconcile):**
18. `reconciliation_data: Array<Record<string, any>>`

**Output (update_memory):**
19. `updated_profile: Record<string, any>`

**Metadata:**
20. `errors: Array<string>`
21. `warnings: Array<string>`
22. `workflow_started_at: string`
23. `workflow_completed_at: string`

**Routing:**
24. `next_analyzers: Array<string>`
25. `completed_analyzers: Array<string>`

**Total:** 25 fields

---

## TypeScript Implementation Checklist

### Phase 1: State Schema
- [ ] Create `src/browser/agents/iab-classifier/state.ts`
- [ ] Port all 25 WorkflowState fields as Annotation.Root
- [ ] Use proper reducers (replace vs append)
- [ ] Add TypeScript types for all structures

### Phase 2: Graph Structure
- [ ] Update `src/browser/agents/iab-classifier/index.ts`
- [ ] Delete wrong 3-node implementation
- [ ] Create 6-node workflow
- [ ] Add 2 conditional edges
- [ ] Verify flow matches Python exactly

### Phase 3: Node Implementation
- [ ] Create `nodes/loadEmails.ts` (port load_new_emails_node)
- [ ] Create `nodes/retrieveProfile.ts` (port retrieve_existing_profile_node)
- [ ] Create `nodes/analyzeAll.ts` (port analyze_all_node)
- [ ] Create `nodes/reconcile.ts` (port reconcile_evidence_node)
- [ ] Create `nodes/updateMemory.ts` (port update_memory_node)
- [ ] Create `nodes/advanceEmail.ts` (port _advance_email_node)

### Phase 4: Conditional Functions
- [ ] Port `_check_has_emails_conditional`
- [ ] Port `_check_continuation_conditional`

### Phase 5: Testing
- [ ] Test each node individually
- [ ] Test full workflow end-to-end
- [ ] Verify against Python behavior
- [ ] All tests passing

---

## Verification Protocol

Before marking complete:
- [ ] Node count: 6 (matches Python)
- [ ] Conditional edges: 2 (matches Python)
- [ ] State fields: 25 (matches Python)
- [ ] Workflow flow: 1:1 with Python graph
- [ ] No simplifications or divergences
- [ ] Tests passing

---

**Status:** Not started - awaiting deletion of wrong implementation
