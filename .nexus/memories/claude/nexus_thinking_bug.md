# Nexus Code - Thinking Budget Bug

## The Problem
When using interleaved thinking (beta header), Claude instances are throwing:
```
`max_tokens` must be greater than `thinking.budget_tokens`
```

This error is **misleading/wrong** because:
- **Extended Thinking** (old): `thinking.budget_tokens` must be < `max_tokens` (per response limit)
- **Interleaved Thinking** (new, beta): `budget_tokens` is the FULL CONVERSATION budget (200k), NOT per-message
  - The 64k `max_tokens` is separate (per-message output limit)
  - When using interleaved thinking beta header, DON'T pass `thinking` object

## Root Cause
In `unified-model-manager.ts` the code is:
1. Adding `interleaved-thinking-2025-05-14` to beta headers ✅
2. ALSO passing `thinking: { type: 'enabled', budget_tokens: 200000 }` ❌

**These are mutually exclusive.** Interleaved thinking doesn't use the `thinking` object.

## Solution
When `supportsInterleavedThinking` is true:
- Use ONLY the beta header
- Remove the `thinking` object entirely
- The beta header handles the thinking budget automatically

When `supportsThinking` is true (but NOT interleaved):
- Use ONLY the `thinking` object
- Make sure `thinking.budget_tokens` < `max_tokens`
- Don't use interleaved thinking beta header

## Files to Fix
- `/src/core/models/unified-model-manager.ts`
  - `sendAnthropicMessage()` method
  - `streamAnthropicMessage()` method

## Model Capabilities (As of Nov 2024)
- **Haiku 4.5**: supportsThinking=true, supportsInterleavedThinking=true, maxTokens=64000, contextWindow=200000
- **Sonnet 4/4.5**: supportsThinking=true, supportsInterleavedThinking=true, maxTokens=64000, contextWindow=1000000
- **Opus 4.1**: supportsThinking=true, supportsInterleavedThinking=true, maxTokens=32000, contextWindow=200000
