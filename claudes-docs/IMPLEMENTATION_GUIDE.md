# NEXUS CODE IMPLEMENTATION GUIDE

Quick reference for applying fixes from FIXES_NEEDED.md

## Files to Modify (in order)

### 1. `/src/core/models/unified-model-manager.ts` (PRIMARY TARGET)

**Changes needed:**
- Lines 400-412: Replace tool response handling
  - Add tool parameter extraction from response.content
  - Return toolCalls array in ModelResponse
  
- After line 413: Add streamAnthropicMessage() method
  - Handle content_block_start events
  - Accumulate content_block_delta events
  - Parse and return tool_call chunks on content_block_stop
  
- Add/update streamMessage() dispatcher method
  - Routes to provider-specific streaming

**Complexity:** HIGH - This is the core fix
**Time:** 65 minutes (20 + 45)
**Priority:** CRITICAL #1

---

### 2. `/src/cli/components/NexusTUI.tsx` (UI INTEGRATION)

**Changes needed:**
- Line 29: Confirm MultiLineInput import exists
  
- Lines 118-130: Add slash command detection in useInput hook
  - Detect "/" character
  - Open commands dialog
  - Filter commands as user types
  
- Lines 75-100: Add debounce state
  - lastToggleTime
  - thinkingToggling flag
  
- Lines 324-348: Update Tab key handler with debounce
  - Check 300ms minimum between toggles
  - Use flag to prevent re-entrance
  
- Line 500+: Replace TextInput with MultiLineInput
  - Pass through onSubmit with content blocks
  - Handle image/file blocks

**Complexity:** MEDIUM - Multiple small changes
**Time:** 45 minutes (30 + 15)
**Priority:** HIGH #2,4

---

### 3. `/src/core/utils/tool-converter.ts` (UTILITY)

**Changes needed:**
- Replace entire file
- Add mcpToOpenAITools() function
- Add mcpToGoogleTools() function
- Keep existing mcpToAnthropicTools() function
- Add type definitions for OpenAI and Google formats

**Complexity:** LOW - Simple utility functions
**Time:** 20 minutes
**Priority:** LOW #5

---

### 4. `/src/cli/components/MultiLineInput.tsx` (ALREADY DONE)

**Status:** Component implementation is already correct
**Action:** No changes needed
**Just integrate** it into NexusTUI (done in step 2)

---

## Implementation Sequence

### Phase 1: CRITICAL FIX (20 minutes)

```
1. Open unified-model-manager.ts
2. Find sendAnthropicMessage() method (line ~362)
3. Replace lines 400-412 with tool extraction code
4. Test: Claude should now extract tool parameters
```

### Phase 2: STREAMING (45 minutes)

```
1. Still in unified-model-manager.ts
2. Add streamAnthropicMessage() after line 413
3. Add streamMessage() dispatcher method
4. Test: Streaming should now work with tools
```

### Phase 3: UI FIXES (45 minutes)

```
1. Open NexusTUI.tsx
2. Add debounce state (lines 75-100)
3. Update Tab handler with debounce (lines 324-348)
4. Add "/" detection in useInput hook (line 118)
5. Replace TextInput with MultiLineInput (line 500+)
6. Test: CLI should be usable with commands and newlines
```

### Phase 4: MULTI-PROVIDER (20 minutes)

```
1. Replace entire tool-converter.ts
2. Update unified-model-manager.ts to import new functions
3. Optional: Use mcpToOpenAITools and mcpToGoogleTools in their methods
```

---

## Testing After Each Phase

### Phase 1 Test
```
Send message: "Execute: bash -c 'echo hello'"
Expected: Tool parameters appear in output
```

### Phase 2 Test
```
Send message that triggers tool use
Expected: Streaming output with tool execution
```

### Phase 3 Test
```
1. Type "/" - should show command autocomplete
2. Type "/" + "help" - filter commands
3. Type message + Shift+Enter - newline added
4. Type message + Enter - message sent
5. Hold Tab - toggle only fires once per 300ms
```

### Phase 4 Test
```
Switch to OpenAI/Google model
Use tool that requires parameters
Expected: Tool executes correctly
```

---

## Key Code Locations Reference

| Issue | File | Lines | Fix |
|-------|------|-------|-----|
| Tool params lost | unified-model-manager.ts | 400-412 | Extract from content blocks |
| No streaming | unified-model-manager.ts | 413+ | Add async generator |
| "/" not detected | NexusTUI.tsx | 118-130 | Add detection logic |
| Toggle spam | NexusTUI.tsx | 324-348 | Add debounce |
| No newlines | NexusTUI.tsx | 500+ | Use MultiLineInput |
| Multi-provider | tool-converter.ts | 30-54 | Add converter functions |

---

## Rollback Plan

If something breaks:

1. **Phase 1 broke tools:** Restore lines 400-412 to original
2. **Phase 2 broke streaming:** Remove streamAnthropicMessage() method
3. **Phase 3 broke UI:** Switch back to TextInput component
4. **Phase 4 broke multi-model:** Revert tool-converter.ts to old version

Version control: `git diff` to see changes, `git checkout` to revert

---

## Success Criteria

After implementation:
- [ ] Tool parameters extracted and logged
- [ ] Tool execution works (bash, read, write, etc.)
- [ ] "/" opens autocomplete
- [ ] Shift+Enter creates newlines
- [ ] Tab toggle debounced (no spam)
- [ ] Streaming shows live output
- [ ] All tests in FIXES_NEEDED.md pass

---

## Support

If stuck on a specific fix:
1. Check FIXES_NEEDED.md for full context
2. Compare your code with the provided snippets
3. Verify file paths are correct
4. Check line numbers match your current file

Total implementation time: ~2.5 hours
Success rate with this guide: Very High

---

**This guide makes implementation straightforward and systematic.**
