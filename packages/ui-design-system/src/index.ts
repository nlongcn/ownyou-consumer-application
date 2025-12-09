/**
 * @ownyou/ui-design-system
 *
 * Design tokens, theme provider, and shared primitives for OwnYou.
 * Implements v13 Section 4.3 (Design System Specifications) and 4.4 (Component Library).
 *
 * @example
 * ```tsx
 * import { ThemeProvider, Button, Card, colors } from '@ownyou/ui-design-system';
 *
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <Card>
 *         <Button variant="primary">Click me</Button>
 *       </Card>
 *     </ThemeProvider>
 *   );
 * }
 * ```
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.3, 4.4
 */

// Design Tokens
export * from './tokens';

// Theme Provider
export * from './theme';

// UI Primitives
export * from './primitives';

// Utilities
export * from './utils';
