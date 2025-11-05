# Thinking Mode Fix Strategy

## The Bug
Mixing **Extended Thinking** (old) with **Interleaved Thinking** (new beta) in `unified-model-manager.ts`

### Extended Thinking (Claude 3.5+, non-beta)
```typescript
thinking: {
  type: 'enabled',
  budget_tokens: 200000,  // Per-response limit
}
// Requirement: budget_tokens < max_tokens
```

### Interleaved Thinking (Beta: interleaved-thinking-2025-05-14)
```typescript
// DO NOT PASS thinking object!
// Beta header handles it automatically
// budget_tokens becomes the FULL conversation budget (200k)
// max_tokens is still per-message (64k)
```

## The Solution
In `sendAnthropicMessage()` and `streamAnthropicMessage()`:

1. **If using interleaved thinking beta**: Remove the `thinking` object from requestOptions, let beta header handle it
2. **If using extended thinking**: Calculate `budget_tokens = max_tokens * 0.5` (safe ratio)
3. **Never mix both** - check which one is enabled, use ONE approach

## Key Code Change
```typescript
// OLD (BROKEN):
if (useThinking && {
  thinking: {
    type: 'enabled',
    budget_tokens: 200000,  // ALWAYS TOO BIG
  },
})

// NEW (FIXED):
if (useInterleavedThinking) {
  // Beta header handles thinking - DON'T add thinking object
  betaFeatures.push('interleaved-thinking-2025-05-14');
} else if (useThinking) {
  // Extended thinking - safe budget calculation
  const thinkingBudget = Math.floor(maxTokens * 0.5);
  thinking: {
    type: 'enabled',
    budget_tokens: thinkingBudget,
  }
}
```

## Models & Their Thinking Support
- **Haiku 4.5**: Extended + Interleaved (new!)
- **Sonnet 4/4.5**: Extended + Interleaved (new!)
- **Opus 4.1**: Extended + Interleaved (new!)

All support BOTH modes - just don't mix them in same request.
