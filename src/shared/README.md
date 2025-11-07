# Shared Module

**Purpose:** Type definitions and schemas shared across browser and future server modules

## Structure

- `types/` - TypeScript type definitions
  - IAB classification types
  - Mission card types
  - Store namespace types
  - API contract types

- `schemas/` - Zod validation schemas
  - Data model validation
  - API request/response validation
  - Store data validation

## Design Principles

- **Single Source of Truth:** One definition for each data model
- **Type-Safe:** Full TypeScript coverage
- **Validation:** Runtime validation via Zod
- **Backward Compatible:** Maintain compatibility with Python email_parser output
