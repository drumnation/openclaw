/**
 * Feature Registration Index
 *
 * Import all feature modules here. Each module self-registers
 * with the feature registry on import.
 *
 * To add a new feature:
 * 1. Create a new file in this directory
 * 2. Have it call featureRegistry.register(...)
 * 3. Import it here
 * 4. Set enabled: true when ready for dev testing
 */
import "./tasks.js";
import "./grove-viewer.js";

// Clickable markdown paths (not a tab feature, but exports utilities)
export * from "./markdown-paths.js";

// Future features:
// import "./dashboard.js";
