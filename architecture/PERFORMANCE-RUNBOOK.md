# Performance Verification Runbook

**Created:** 2026-03-20
**Purpose:** Manual verification procedures for P1 and P2 performance gates
**When:** Before every release to production

---

## Overview

Performance gates P1 and P2 cannot be CI-automated because they require real device/simulator profiling with Expo DevTools. This runbook provides reproducible steps for release verification.

| Gate | Criteria | Measurement Tool |
|------|----------|------------------|
| P1 | App cold start <1000ms | Expo DevTools Performance Monitor |
| P2 | Anchor scroll 30+ cards at 60fps | React DevTools Profiler |
| P3 | Search results <300ms | CI-automated (see `tests/performance/benchmarks.test.ts`) |

---

## Prerequisites

1. **Development build** on iOS Simulator or Android Emulator (not Expo Go for accurate timing)
2. **Expo DevTools** connected (`npx expo start --dev-client`)
3. **React DevTools** standalone (`npx react-devtools`)
4. Test data: 30+ anchor cards loaded (use seed script or manual entry)

### Test Data Setup

```bash
# If you need test data, generate it via the app or use this SQL:
# INSERT 30+ Class records for today's date
```

---

## P1: Cold Start Verification (<1000ms)

### Definition
Cold start = time from app launch (user taps icon) to first meaningful content rendered (anchor cards visible).

### Steps

1. **Kill the app completely** (swipe away from app switcher)

2. **Start Expo DevTools Performance Monitor**
   - Open Expo DevTools in browser
   - Navigate to "Performance" tab
   - Enable "Record startup performance"

3. **Launch the app** by tapping the app icon

4. **Stop recording** once anchor screen is fully rendered

5. **Read the metrics**
   - Look for "JS Bundle Load Time"
   - Look for "First Render Time"
   - Total = Bundle Load + First Render
   - **Pass if total < 1000ms**

### Fallback Method (Manual Timing)

If DevTools are unavailable:

1. Start screen recording on device
2. Kill app completely
3. Tap app icon (note the frame)
4. Stop recording when anchor cards appear
5. Count frames: 60fps = 16.67ms per frame
6. **Pass if < 60 frames (1000ms)**

### Common Causes of Regression

- Large JS bundle size (check with `npx expo export --dump-assetmap`)
- Synchronous SQLite operations on main thread
- Heavy computed field calculations at startup
- Too many re-renders during hydration

---

## P2: Scroll Performance (60fps with 30+ cards)

### Definition
Anchor screen must maintain 60fps while scrolling through 30+ cards. Dropped frames indicate jank.

### Steps

1. **Ensure 30+ cards exist** in anchor view
   - Navigate to Anchor screen
   - Verify card count (scroll to bottom and back)

2. **Connect React DevTools Profiler**
   ```bash
   npx react-devtools
   ```
   - Click "Profiler" tab
   - Enable "Record why each component rendered"

3. **Start profiling** (click Record button)

4. **Scroll rapidly** through all cards
   - Flick up/down several times
   - Include fast scrolls and slow scrolls
   - Scroll for ~10 seconds

5. **Stop profiling** (click Record button again)

6. **Analyze the flamegraph**
   - Look for renders taking >16ms (red/yellow in profiler)
   - Check "Ranked" view for slowest components
   - **Pass if no renders exceed 16ms consistently**

### Alternative: FPS Overlay

1. In Expo DevTools, enable "Show FPS Monitor"
2. Overlay shows current FPS in top-left
3. Scroll through cards while watching FPS
4. **Pass if FPS stays at 60 (occasional 58-59 acceptable)**

### Common Causes of Jank

- Re-rendering all cards on scroll (missing `React.memo`)
- Image loading without placeholders
- Heavy computed fields recalculating
- Layout thrashing from dynamic heights
- Missing `keyExtractor` in FlatList

---

## Verification Checklist

Before release, complete this checklist:

```
[ ] P1: Cold start measured at _____ ms (must be <1000ms)
[ ] P2: Scroll FPS measured at _____ fps (must be 60fps)
[ ] P3: CI tests passing (automated)
[ ] Device/Simulator used: _____________________
[ ] Date verified: _____________________
[ ] Verified by: _____________________
```

---

## Troubleshooting

### P1 Fails (Cold start >1000ms)

1. Profile JS bundle: `npx expo export --dump-assetmap`
2. Check for synchronous database calls in root components
3. Review `useEffect` hooks that run on mount
4. Consider lazy loading non-critical modules

### P2 Fails (Scroll jank)

1. Add `React.memo` to card components
2. Move computed fields to query time (not render time)
3. Use `getItemLayout` for fixed-height cards
4. Profile with "Highlight updates" in React DevTools

---

## Baseline Metrics

Record baseline metrics here after each release:

| Version | P1 (Cold Start) | P2 (Scroll FPS) | Device | Date |
|---------|-----------------|-----------------|--------|------|
| 0.0.3.0 | TBD | TBD | TBD | 2026-03-20 |

---

*This runbook satisfies the Performance Verification Procedures TODO from TODOS.md*
