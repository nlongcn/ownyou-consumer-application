Local Data Model (Encrypted IndexedDB)

Key Stores
- accounts: { id, provider, email, scopes, created_at, updated_at }
- messages: { id, account_id, provider_id, date, subject, snippet, body_raw(enc), labels, folder, size, hash }
- parsed_entities: { id, message_id, merchants, products, totals, dates, travel, categories, topics }
- analyses: { id, account_id, range, type: 'ikigai'|'marketing', seed, model, coverage, confidence, json }
- recommendations: { id, analysis_id, source: 'asin'|'switched'|'amadeus', items }
- keys: { id, type: 'openai'|'anthropic'|'asin'|'switched'|'amadeus', key(enc), meta }
- shares: { id, analysis_id, type: 'file'|'url'|'drive'|'onedrive', payload(enc)|link, created_at }

Encryption
- Per-store data encryption using AES-GCM with unique nonces. Key hierarchy: KEK derived from passphrase → per-store DEKs. Rotateable via rewrap.

Indexes
- messages: by account_id, by date, by label/folder; parsed_entities by message_id; analyses by account_id and type; recommendations by analysis_id.

Retention
- User-configurable retention in days; scheduled cleanups; explicit “wipe all data”.

Schemas should include schema_version and generator metadata for exports and migrations.

