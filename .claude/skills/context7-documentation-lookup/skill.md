---
name: context7-documentation-lookup
description: MANDATORY skill - use context7 MCP to fetch current library documentation BEFORE using any library or package. Must be used EVERY time you import or use external code.
---

# Context7 Documentation Lookup - MANDATORY

## When This Skill Applies

**EVERY TIME** you:
- Import a library (e.g., `from langchain import ...`, `import pydantic`)
- Use a framework (e.g., LangGraph, FastAPI, React)
- Reference API documentation (e.g., OpenAI, Anthropic)
- Write code using external packages
- Update existing code that uses libraries
- Debug library-related issues

**NO EXCEPTIONS** - If you're using external code, you MUST use context7.

## Mandatory Workflow

### Step 1: Identify the Library
Before writing ANY code using a library, identify:
- Exact library name (e.g., "langchain", "pydantic", "langgraph")
- What you need to do with it
- Which specific features/functions you need

### Step 2: Resolve Library ID
Use `mcp__context7__resolve-library-id` to get the Context7-compatible library ID:

```
Tool: mcp__context7__resolve-library-id
Parameters:
  libraryName: "langchain"
```

**DO NOT SKIP THIS STEP** - You need the exact library ID for the next step.

### Step 3: Get Current Documentation
Use `mcp__context7__get-library-docs` with the resolved library ID:

```
Tool: mcp__context7__get-library-docs
Parameters:
  context7CompatibleLibraryID: "/langchain/langchain"  # from step 2
  topic: "agents"  # specific to what you're doing
  tokens: 5000  # adjust based on need
```

### Step 4: Use Current Documentation
- Read the documentation returned
- Use ONLY patterns from current docs (not your training data)
- If docs show breaking changes, adapt your code
- If docs show new best practices, follow them

## Examples

### Example 1: Using LangGraph Store
```
WRONG ❌:
User: "Create a Store namespace"
Assistant: *writes code based on memory*

CORRECT ✅:
User: "Create a Store namespace"
Assistant:
1. Uses mcp__context7__resolve-library-id for "langgraph"
2. Uses mcp__context7__get-library-docs with topic "store"
3. Reads current Store documentation
4. Writes code following current patterns
```

### Example 2: Using Pydantic Models
```
WRONG ❌:
User: "Create a Pydantic model"
Assistant: *writes BaseModel from memory*

CORRECT ✅:
User: "Create a Pydantic model"
Assistant:
1. Uses mcp__context7__resolve-library-id for "pydantic"
2. Uses mcp__context7__get-library-docs with topic "models"
3. Checks current Pydantic version syntax
4. Writes model using current best practices
```

### Example 3: Debugging Library Issue
```
WRONG ❌:
User: "Why isn't this LangGraph code working?"
Assistant: *guesses based on memory*

CORRECT ✅:
User: "Why isn't this LangGraph code working?"
Assistant:
1. Uses context7 to fetch current LangGraph docs for relevant feature
2. Compares code against current documentation
3. Identifies version mismatches or deprecated patterns
4. Fixes code using current patterns
```

## Integration with Existing Skills

### Before Using These Skills, Use Context7:
- **langgraph-workflow-development** - Get current LangGraph docs first
- **testing-discipline** - Get current pytest/testing library docs first
- **store-schema-design** - Get current LangGraph Store docs first

### TodoWrite Integration:
Always include context7 lookup in your todos:

```python
todos = [
    {"content": "Resolve library ID for LangGraph", "status": "pending"},
    {"content": "Get current LangGraph Store documentation", "status": "pending"},
    {"content": "Implement Store namespace using current docs", "status": "pending"},
]
```

## Why This Matters

**Problem Without Context7:**
- Using outdated patterns from training data
- Missing breaking changes in libraries
- Implementing deprecated features
- Debugging with old documentation

**Solution With Context7:**
- Always using current library versions
- Catching breaking changes immediately
- Following latest best practices
- Debugging with accurate information

## Validation Checklist

Before writing code using a library, confirm:
- [ ] Resolved library ID using context7
- [ ] Fetched current documentation for specific feature
- [ ] Read documentation for the feature you're implementing
- [ ] Code follows patterns from current docs (not memory)
- [ ] If debugging, checked current docs for changes

## Common Rationalizations (All Wrong)

❌ "I know this library well" → Libraries change, use context7
❌ "This is a simple import" → Breaking changes happen in simple code too
❌ "I just used this yesterday" → Use context7 anyway, enforce the pattern
❌ "The docs probably haven't changed" → Check anyway, it's fast
❌ "I'll look it up if it breaks" → Look it up BEFORE it breaks

**If you catch yourself thinking ANY of these, STOP and use context7.**

## Implementation Example

**Full workflow for implementing LangGraph Store namespace:**

```
1. User request: "Create a Store namespace for shopping preferences"

2. Resolve library ID:
   mcp__context7__resolve-library-id(libraryName="langgraph")
   Result: "/langchain-ai/langgraph"

3. Get current docs:
   mcp__context7__get-library-docs(
     context7CompatibleLibraryID="/langchain-ai/langgraph",
     topic="store namespaces",
     tokens=5000
   )

4. Read documentation:
   - Current Store API syntax
   - Namespace naming conventions
   - Item structure requirements
   - Best practices

5. Write code using CURRENT patterns:
   ```python
   from langgraph.store import Store  # from current docs

   store = Store()  # current initialization

   namespace = ("ownyou.shopping_preferences", user_id)  # current pattern

   store.put(namespace, "preferences", {
       "preferred_retailers": ["Amazon", "Target"],
       "price_threshold": 50.0
   })  # current method signature
   ```

6. Verify code matches current docs (not memory)
```

## Reference

- Context7 MCP tools in CLAUDE.md tool list
- Before Writing Code Checklist in CLAUDE.md (step 3)
- Development Guidelines (Context7 section)
