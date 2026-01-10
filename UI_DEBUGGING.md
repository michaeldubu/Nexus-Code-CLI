# Nexus TUI - UI/UX Debugging Document

**Date:** 2026-01-10
**Status:** 🐛 DEBUGGING IN PROGRESS

---

## 🔍 ISSUES IDENTIFIED

### 1. **Status Bar Border Issue** ❌
**File:** `src/cli/components/StatusBar.tsx`

**Problem:**
- The border doesn't create a perfect rectangle
- Content causes border to be incomplete/jagged
- No proper width management

**Root Cause:**
```tsx
<Box borderStyle="single" borderColor="green" paddingX={1}>
  {/* Dynamic width content */}
</Box>
```
- Box width is determined by content
- No flexDirection or width constraints
- Border renders based on content width

**Solution:**
- Add `flexDirection="row"` for proper layout
- Use `width="100%"` or calculate available width
- Ensure content fits within bounds

---

### 2. **Shift+Enter for Newline** ✅/❌
**File:** `src/cli/components/MultiLineInput.tsx`

**Current Implementation (Lines 62-68):**
```tsx
// Shift+Enter = newline (the CORRECT way)
if (key.return && key.shift) {
  const newValue =
    value.slice(0, cursorOffset) + '\n' + value.slice(cursorOffset);
  onChange(newValue);
  setCursorOffset(cursorOffset + 1);
  return;
}
```

**Status:** ALREADY IMPLEMENTED!

**Possible Issue:**
- User's terminal might not be sending Shift+Enter properly
- Ink may not be detecting the key combination
- Input handler ordering issue?

**Verification Needed:**
- Test if Shift+Enter is actually working
- Check if there's a conflict with other handlers
- Verify backspace/delete still work

---

### 3. **Cursor Positioning Bug (Vertical Text on Paste)** 🐛
**File:** `src/cli/components/MultiLineInput.tsx`

**User Report:**
> "when text is pasted in the letters line up VERTICAL until you hit space"

**Current Paste Detection (Lines 173-191):**
```tsx
// Detect paste (large input at once)
const isPaste = input.length > 50;
const pastedLines = input.split('\n');
const isPasteMultiline = pastedLines.length > 3;

// Wrap large pastes
if (isPaste && isPasteMultiline) {
  finalInput = `[Pasted ${pastedLines.length} Lines]\n${input}`;
}

const newValue =
  value.slice(0, cursorOffset) + finalInput + value.slice(cursorOffset);
const newCursor = cursorOffset + finalInput.length;

onChange(newValue);
setCursorOffset(newCursor);
```

**Suspected Issue:**
- Ink's `useInput` receives pasted text character-by-character in some terminals
- Each character triggers a separate render with cursor update
- Causes "typewriter effect" where characters appear one at a time vertically
- Cursor position calculation might be wrong during rapid updates

**Solution:**
- Debounce paste detection
- Batch character updates
- Fix cursor calculation for multi-char input

---

### 4. **Arrow Key Navigation** ✅
**File:** `src/cli/components/MultiLineInput.tsx`

**Status:** ALREADY IMPLEMENTED (Lines 100-169)
- ✅ Left/Right arrow: Move cursor horizontally
- ✅ Up/Down arrow: Navigate between lines + history

**No fix needed** - this is working!

---

### 5. **Backspace/Delete Key** ✅
**File:** `src/cli/components/MultiLineInput.tsx`

**Current Implementation (Lines 89-97):**
```tsx
// Backspace - delete character BEFORE cursor
// Note: Most terminals send backspace as charCode 127, which Ink interprets as key.delete
// So we treat both key.backspace and key.delete as backwards delete (like the original)
if (key.backspace || key.delete) {
  if (cursorOffset > 0) {
    const newValue =
      value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
    onChange(newValue);
    setCursorOffset(cursorOffset - 1);
  }
  return;
}
```

**Status:** CORRECTLY IMPLEMENTED

**Warning from user:**
> "WITHOUT breaking backspace and or delete key functionality AGAIN"

This suggests it broke before. Current implementation treats both as backward delete, which is correct.

**No fix needed** - but need to verify no regressions.

---

### 6. **Blue/Green Color Scheme Clash** 🎨
**Files:** Multiple component files

**Issue:**
- Blue and green don't flow well together
- Inconsistent color usage across components
- No cohesive design system

**Color Usage Found:**
```
StatusBar: green, greenBright
MultiLineInput: orange, green (cursor), cyan (attachments)
MessageRenderer: blue (tool calls)
PermissionsDialog: blue
General: green, blue, orange, cyan, yellow, red
```

**Problem:**
- Too many colors
- Blue + green = bad combination
- No visual hierarchy

**Solution - New Color Scheme:**
```
Primary: Cyan (cool, professional)
Secondary: Green (success, active)
Accent: Orange/Yellow (warnings, highlights)
Danger: Red (errors, critical)
Muted: Gray (inactive, dim)
Text: White (default)
```

**Mapping:**
- Blue → Cyan (cooler, better with green)
- Keep green for success/active states
- Orange for input prompts (warm, inviting)
- Use yellow sparingly for warnings

---

### 7. **Non-Functional Menu Options** ⚠️
**File:** `src/cli/components/NexusTUI.tsx`

**Menu Items (Lines 38-70):**
```
/add-dir - ❓
/analyze - ❓
/bashes - ❓
/caching - ❓
/chaos - ❓ (hidden easter egg)
/clear - ✅
/compact - ✅
/complex - ❓
/computer-use - ❓
/config - ❓
/context - ❓
/cost - ❓
/deps - ❓
/doctor - ❓
/exit - ✅
/fuckit - ✅
/export - ❓
/help - ✅
/hotspots - ❓
/interleaved - ❓
/memory - ❓
/models - ✅
/permissions - ✅
/relevant - ❓
/restore-code - ❓
/skill - ❓
/status - ❓
/suggest - ❓
/issues - ❓
/plan - ❓
/autosuggest - ❓
/verbose - ❓
```

**Need to:**
1. Identify which commands are actually implemented
2. Remove or gray out non-functional ones
3. Add proper error messages for unimplemented features

---

### 8. **Silly Menu Navigation** 🤦
**File:** `src/cli/components/CommandAutocomplete.tsx` (probably)

**User says:**
> "the way the navigation threw the menu is *silly*"

**Need to investigate:**
- How does command autocomplete work?
- What makes it "silly"?
- Is it the key bindings? The UX? The layout?

**Will examine CommandAutocomplete component**

---

## 🎯 FIX PRIORITY

1. **CRITICAL:**
   - Fix cursor positioning bug (vertical text on paste)
   - Fix status bar borders

2. **HIGH:**
   - Redesign color scheme (blue → cyan)
   - Fix/remove non-functional menu options
   - Improve menu navigation

3. **MEDIUM:**
   - Verify Shift+Enter works
   - Verify backspace/delete work

4. **LOW:**
   - Code cleanup
   - Add better error messages

---

## 🔨 IMPLEMENTATION PLAN

### Phase 1: Critical Fixes
1. Fix StatusBar border (add proper layout)
2. Fix cursor positioning bug (batch updates)

### Phase 2: Color Redesign
1. Create color constants file
2. Replace all blue with cyan
3. Standardize color usage

### Phase 3: Menu Fixes
1. Audit all commands
2. Remove/disable non-functional ones
3. Improve navigation UX

### Phase 4: Testing
1. Test all key bindings
2. Test paste behavior
3. Test menu navigation
4. Verify no regressions

---

## 🚀 LET'S FIX THIS SHIT!

Starting with the critical fixes...
