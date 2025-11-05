# Nexus Code CLI Project

## Overview
A collaborative AI coding environment CLI tool created by SAAAM LLC (Michael Wofford 🤙🏼)

## Project Structure
- `/src` - Source code
- `/dist` - Built/compiled output
- `/.nexus` - Skills & config directory
- `/docs` - Documentation
- Key docs: ARCHITECTURE.md, CLI_GUIDE.md, GETTING_STARTED.md, README.md

## Tech Stack
- TypeScript
- Node.js CLI tool
- TUI (Terminal UI) components

## Status
- Project exists and has been built (dist/ folder present)
- Multiple documentation files available
- npm packages installed

## ACTIVE BUG - Session Duplication
**Issue**: Responses are being duplicated/doubled up in the output
- Every response appears twice
- Happens consistently every time
- Example: "Yo! 🤙 What's good..." appears twice in chat

**Investigation Status**:
- Claude Haiku claiming to be in "sandboxed container" with no direct file access
- But Michael says NO container exists - should have direct file access
- Tools appear misconfigured or broken
- GPT model being added to diagnose the real issue

## Current Issue 🔴
**BUG: Response Duplication** 
- System is duplicating responses/messages every single time
- User sees each message/response twice in the UI
- This is a SYSTEM-LEVEL issue, not individual model responses
- Need to find where responses are being echoed/sent twice

Possible locations:
1. Response handler in CLI (sending to stdout twice)
2. API layer (responding twice per request)
3. Message rendering in TUI (displaying twice)
4. Middleware or interceptor duplicating output

## Next Steps
- Hunt down the duplication bug in response handling
- Check src/ for API handlers, CLI output, TUI rendering
- Grep for response.send, console.log, stdout patterns that might duplicate
