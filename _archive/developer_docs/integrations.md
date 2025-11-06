Integrations (Developer Keys, Direct from Browser)

ASIN Data API
- Purpose: Product discovery and images matched to Marketing/Ikigai categories.
- Input: Derived categories, tags, optional price range; never raw email content.
- Endpoints: Category/keyword search; product lookup by ASIN.
- Output: title, ASIN, images (primary/alt), price, rating, url, availability.
- Rate limits & Caching: Respect provider limits; in-memory cache per session; exponential backoff.
- Safety: Merchant allowlist; image license checks; broken-image fallbacks.

Switched API (Bills)
- Purpose: Identify better deals for utilities/insurance/mobile from inferred receipts.
- Input: merchant name, category, inferred plan/price if available; no PII or raw invoices.
- Output: offers with plan details and expected savings; link to switch.
- Guardrails: Do not transmit names, addresses, account numbers.

Amadeus (Travel)
- Purpose: Travel inspiration/destinations aligned with interests and time windows.
- Input: destination themes, date windows, budget bands; no traveler PII.
- Output: suggested trips, images if available, metadata for cards.

Key Handling
- Developer-managed keys embedded in application for proof-of-concept.
- Outbound requests visible in a Request Inspector UI panel for transparency.

