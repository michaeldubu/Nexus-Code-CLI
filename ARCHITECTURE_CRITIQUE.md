# Nexus Code CLI - Architecture Critique & Refactor Plan

**Date:** 2026-01-10
**Status:** CRITICAL REFACTOR NEEDED

---

## 🔥 CRITICAL ISSUES

### 1. **NOT TRUE RAG - SCALABILITY NIGHTMARE**

**Current State:**
- `ContextIntelligence` is NOT RAG (Retrieval-Augmented Generation)
- It's just static code analysis with keyword matching
- No vector embeddings, no semantic search
- Uses simple relevance scoring based on:
  - Path/name matching (keyword search)
  - Dependency graph traversal
  - Git history analysis
  - Co-change detection

**Problems:**
- ❌ Doesn't scale to large codebases (>10k files)
- ❌ No semantic understanding of code
- ❌ Keyword matching misses conceptually similar code
- ❌ Can't answer "find code that does X" without exact keywords
- ❌ Context window fills up quickly without proper retrieval

**What We Need:**
- ✅ Vector embeddings for code chunks (use OpenAI embeddings or local model)
- ✅ Vector database (ChromaDB, Pinecone, or local FAISS)
- ✅ Semantic search for "find code that implements authentication"
- ✅ Chunk-level retrieval (not whole files)
- ✅ Hybrid search (vector + keyword + graph)

---

### 2. **CANNOT USE MULTIPLE INSTANCES OF SAME MODEL**

**Current State:**
```typescript
// MultiModelManager.tsx
const [selectedModels, setSelectedModels] = useState<string[]>([]);
// This is just model IDs: ['claude-sonnet-4-5', 'gpt-5']
```

**Problems:**
- ❌ Can't have 5x Sonnet-4.5 running in parallel
- ❌ `activeModels` is an array of model IDs, NOT instances
- ❌ UnifiedModelManager only manages ONE currentModel
- ❌ No concept of model "instances" - only model "types"

**What We Need:**
```typescript
// New architecture:
interface ModelInstance {
  id: string; // unique instance ID (e.g., "sonnet-1", "sonnet-2")
  modelId: string; // model type (e.g., "claude-sonnet-4-5")
  manager: UnifiedModelManager; // separate manager per instance
  config: ModelInstanceConfig; // per-instance settings
}

// User can add:
// - 5x Sonnet-4.5 (different instances, same model)
// - 10x Haiku-4.5
// - 3x GPT-5
// ALL running in parallel, ALL receiving same message
```

---

### 3. **MODE DOESN'T AUTO-SWITCH**

**Current State:**
- When you select multiple models via `/models`, it doesn't auto-change mode
- User has to manually know to switch modes
- Default mode stays as 'single' even with multiple models

**What We Need:**
- ✅ Auto-detect when multiple models selected
- ✅ Auto-switch to appropriate mode:
  - 1 model → 'single'
  - 2-5 models → 'parallel' (default for multi-model)
  - Many models → let user choose

---

### 4. **ARCHITECTURE LIMITATIONS**

**Current State:**
```
UnifiedModelManager (singleton)
  ├─ currentModel: string
  ├─ anthropic client
  ├─ openai client
  └─ google client
```

**Problems:**
- ❌ Only ONE active model at a time
- ❌ Switching models resets conversation chain
- ❌ Can't maintain separate conversations per instance
- ❌ All instances share same clients (race conditions?)

**What We Need:**
```
ModelPool
  ├─ instances: Map<instanceId, ModelInstance>
  ├─ addInstance(modelId, config) → instanceId
  ├─ removeInstance(instanceId)
  ├─ streamToAll(message, instanceIds[])
  └─ streamToEach(message, instanceIds[]) → parallel responses

ModelInstance
  ├─ id: string (unique)
  ├─ modelId: string (type)
  ├─ manager: UnifiedModelManager (isolated)
  ├─ conversationHistory: Message[]
  └─ streamMessage() → isolated stream
```

---

### 5. **BASH TOOL COULD BE BETTER UTILIZED**

**Current State:**
- Bash is just another tool in the tool list
- Approval system is good
- Background execution exists

**What Could Be Better:**
- 🤔 Bash could be used for MORE intelligence gathering
- 🤔 Auto-run `ls`, `tree`, `find` to build better context
- 🤔 Use `git` more aggressively for change detection
- 🤔 Parse bash output to build structured knowledge

---

### 6. **HIDDEN ISSUES / CODE SMELLS**

**Found Issues:**

1. **Security:**
   - `eval()` in agent-sdk-manager.ts:96 ⚠️
   - Bash whitelist uses string prefix matching (bypass-able)

2. **Performance:**
   - Context Intelligence runs AFTER TUI mount (blocking)
   - Relevance cache unbounded (memory leak on huge codebases)
   - Large files (>100KB) completely blocked

3. **Type Safety:**
   - `any` types used in tool converters
   - Message content types inconsistent (string | ContentBlock[])

4. **Error Handling:**
   - Silent failures in MCP connection (good UX, bad debugging)
   - Git operations don't handle non-git repos well
   - No retry logic for failed API calls

5. **Architecture:**
   - NexusTUI.tsx is 2,025 lines (MASSIVE component)
   - Tight coupling between UI and business logic
   - No separation of concerns

---

## 🎯 REFACTOR PLAN

### Phase 1: Multi-Model Instance Support (CRITICAL)

**Files to modify:**
- `src/core/models/model-pool.ts` (NEW)
- `src/cli/components/MultiModelManager.tsx` (REFACTOR)
- `src/cli/components/ModelSelector.tsx` (UPDATE)
- `src/cli/components/NexusTUI.tsx` (UPDATE)

**Changes:**
1. Create `ModelPool` class to manage multiple instances
2. Change `activeModels: string[]` to `activeInstances: ModelInstance[]`
3. Add UI to add/remove model instances
4. Support N instances of same model type
5. Auto-mode switching when instances > 1

### Phase 2: True RAG Implementation

**Files to create:**
- `src/core/rag/vector-store.ts` (NEW)
- `src/core/rag/embeddings.ts` (NEW)
- `src/core/rag/retrieval.ts` (NEW)

**Changes:**
1. Add ChromaDB or FAISS for vector storage
2. Chunk code into semantic units
3. Generate embeddings (OpenAI or local)
4. Hybrid search (vector + keyword + graph)
5. Smart context injection

### Phase 3: Fix Everything Else

**Changes:**
1. Remove `eval()`, use safer alternatives
2. Add bounded cache sizes
3. Improve error handling
4. Add retry logic for API calls
5. Split NexusTUI into smaller components
6. Better TypeScript types

---

## 📊 IMPACT ANALYSIS

### Multi-Model Instances
- **User Value:** MASSIVE - run 50 models in parallel
- **Complexity:** Medium
- **Breaking Changes:** Yes (API changes)

### True RAG
- **User Value:** CRITICAL - scales to huge codebases
- **Complexity:** High
- **Breaking Changes:** No (additive)

### Code Quality Fixes
- **User Value:** Low (invisible to users)
- **Complexity:** Low-Medium
- **Breaking Changes:** No

---

## 🚀 IMPLEMENTATION ORDER

1. **Multi-Model Instances** - User's top priority
2. **Auto-Mode Switching** - Quick win
3. **True RAG** - Big feature, high value
4. **Code Quality** - Ongoing

---

## 🔥 LET'S FUCKING GO
