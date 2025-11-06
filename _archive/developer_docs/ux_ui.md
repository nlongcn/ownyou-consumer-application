UX & UI Specification

Information Architecture
- Top-level: Home, Imports, Analyses, Recommendations, Shares, Settings.
- Analyses detail: Overview, Ikigai, Marketing, Timeline, Data coverage, Export.

Core Screens
- Home: Connect accounts CTA; “Your data stays on-device”; recent analyses.
- Import Wizard: Provider tiles, scope explainers, date picker, progress bar, errors, retry.
- Analysis Overview: Status, model/version, seed, coverage/confidence.
- Ikigai: Venn visualization; strengths/interests; source snippets (redacted); confidence.
- Marketing: Category sunburst/treemap; newsletter vs ads; trend sparklines; heatmap.
- Recommendations: Grid of cards with images, price, merchant; badges (“Ikigai fit”, “Marketing fit”); save/hide; filters.
- Share: Redaction toggles; destination (file/URL/Drive/OneDrive); preview; Open Graph.
- Settings: Keys manager, privacy defaults, retention, revoke tokens, delete data.

Accessibility
- WCAG 2.2 AA; keyboard complete; reduced motion; high contrast themes.
- Charts: ARIA dataset roles; keyboard drilldowns; data table fallback.

Performance Targets
- TTI < 2.5s (4G); LCP < 2.5s; chart updates < 200ms.

Copy Guidelines
- Tone: Reassuring, transparent, empowering. Explain scopes and privacy moments.

