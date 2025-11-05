# Nexus Code CLI - Thinking Bug Fix

## The Problem
Thinking errors after first message - specifically:
```
`max_tokens` must be greater than `thinking.budget_tokens`
```

## Root Cause
**TWO different thinking modes are being mixed:**

1. **Extended Thinking** (old):
   - Pass `thinking: { type: 'enabled', budget_tokens: X }`
   - `budget_tokens` must be < `max_tokens`
   - Used when NOT using interleaved-thinking beta

2. **Interleaved Thinking** (new - beta):
   - Use beta header: `interleaved-thinking-2025-05-14`
   - `budget_tokens` = full context window (200k+)
   - DO NOT pass `thinking` object in request body
   - Separate from per-message output tokens

## The Bug in unified-model-manager.ts
In `sendAnthropicMessage()` and `streamAnthropicMessage()`:

```typescript
// WRONG: Passing both thinking object AND interleaved-thinking beta header
if (useInterleavedThinking) {
  betaFeatures.push('interleaved-thinking-2025-05-14');
}
// ...
...(useThinking && {
  thinking: {
    type: 'enabled',
    budget_tokens: 200000,  // 🔥 CONFLICTS WITH INTERLEAVED
  },
}),
```

## Solution
- If using interleaved thinking (beta header): SKIP the `thinking` object entirely
- If using extended thinking (no beta): use `thinking` object but budget_tokens < max_tokens
- Never mix both

## File Location
`/home/michael/Documents/GitHub/Nexus-Code-CLI/src/core/models/unified-model-manager.ts`

Key sections to fix:
- Line ~290: `sendAnthropicMessage()` - around `requestOptions` creation
- Line ~400+: `streamAnthropicMessage()` - same issue
