# Objective
1. Fix map double-click dot panning bug
2. Remove 2D/3D toggle button from customer distribution map
3. Build interactive tutorial system with Gemini TTS narration, spotlight highlighting, animated cursor, auto-advancing steps, different for admin vs employee

# Tasks

### T001: Fix map dot double-click bug & remove 2D/3D button
- **Blocked By**: []
- **Details**:
  - Fix double-click on dots causing map to pan/zoom
  - Remove 2D/3D toggle button and all is3D state/effects
  - Files: `client/src/pages/dashboard.tsx`

### T002: Create tutorial system component
- **Blocked By**: []
- **Details**:
  - Create `client/src/components/tutorial.tsx`
  - Spotlight overlay, animated cursor, TTS narration, auto-advance
  - Different steps for admin vs employee
  - Files: `client/src/components/tutorial.tsx`

### T003: Add tutorial prompt dialog after login
- **Blocked By**: [T002]
- **Details**:
  - Show dialog after login, localStorage "don't show again"
  - Files: `client/src/App.tsx`

### T004: Review and update docs
- **Blocked By**: [T001, T002, T003]
- **Details**:
  - Files: `replit.md`
