Frontend API Contracts (Local and External)

Local Jobs (in-app)
- POST /imports (virtual): starts import job → { job_id }
- GET /jobs/{job_id}: { status: pending|running|completed|failed, progress:{fetched,parsed}, errors:[] }
- POST /analyses: { account_id, range, type, seed, redact, model_mode } → { job_id }
- GET /analyses/{analysis_id}: returns Ikigai/Marketing JSON with metadata.
- GET /analyses/{analysis_id}/recommendations: returns items with images and reasons.
- POST /shares: { analysis_id, options } → { kind, url|file }
- DELETE /shares/{id}: remove locally stored share or revoke cloud link.

External APIs (Developer Keys)
- ASIN Data API
  - Search: GET/POST search by category/keywords → products[] with images, price, rating, url.
  - Lookup: GET product by ASIN → details.
  - Inputs: derived categories/interests only. No PII.
- Switched (Bills)
  - Deals: POST merchant/category + current plan/price (derived) → offers/savings.
  - No raw receipts or PII.
- Amadeus
  - Inspiration/Search: GET by destination/theme/date windows/budget → trips.
  - No traveler PII.

Error Model
- Local jobs: structured errors with remediation hints; resumable cursors for providers.
- External: normalized rate-limit/backoff; transient vs permanent classification.

Telemetry
- Optional and anonymous only; disabled by default. No content or metadata.

