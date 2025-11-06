# IAB Dashboard Frontend

Next.js 14 frontend for the IAB Taxonomy Profile Dashboard.

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
frontend/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── components/         # React components
│   └── ui/             # shadcn/ui components
├── lib/                # Utilities
│   └── utils.ts        # Helper functions
└── public/             # Static assets
```

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **Charts**: Recharts
- **Icons**: Lucide React

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## API Integration

The frontend connects to the Flask backend API at `http://127.0.0.1:5000`.
API proxying is configured in `next.config.js`.

## Features (In Development)

- [x] Next.js + TypeScript setup
- [x] Tailwind CSS + shadcn/ui integration
- [ ] Authentication flow
- [ ] Main Dashboard page
- [ ] Classification Explorer
- [ ] Evidence Viewer
- [ ] Memory Timeline
- [ ] Confidence Analysis
- [ ] Active Categories browser
- [ ] Mission Preview
- [ ] Analysis Runner UI

## Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000
```

## Design System

Colors, typography, and component styles follow the shadcn/ui design system with support for light and dark modes.

See `/Volumes/T7_new/developer_old/email_parser/docs/DASHBOARD_REQUIREMENTS.md` for complete specifications.
