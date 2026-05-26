export { Home } from './Home'
export { LitterList } from './LitterList'
export { LitterDetail } from './LitterDetail'
export { NewLitter } from './NewLitter'
export { FeedingSession } from './FeedingSession'
// ErrorBoundary must be eager: it is the router's errorElement and must be
// available synchronously if any lazy chunk fails to load.
export { ErrorBoundary } from './ErrorBoundary'

// The routes below are intentionally NOT exported from this barrel.
// They are lazy-imported directly in App.tsx so they land in separate
// chunks, reducing the initial-parse cost for the hot paths above.
// Do not add them back here. Closes GitHub issue #27.
//
// EditFeeding  → ../routes/EditFeeding
// LitterGraph  → ../routes/LitterGraph   (also keeps Recharts / D3 split, closes #5)
// Settings     → ../routes/Settings
// Invite       → ../routes/Invite
// ConflictResolution → ../routes/ConflictResolution
// Debug        → ../routes/Debug
// NotFound     → ../routes/NotFound
