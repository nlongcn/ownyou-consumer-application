OAuth & Self-Sovereign Model

Providers
- Gmail (Google): OAuth 2.0 PKCE SPA with scope `https://www.googleapis.com/auth/gmail.readonly`.
- Outlook/Hotmail (Microsoft): MS Graph OAuth 2.0 PKCE SPA with scope `Mail.Read`.

Constraints
- No server: All flows complete in-browser with PKCE. Tokens stored locally (encrypted IndexedDB). Refresh handled client-side. Revoke per-account.
- Scope transparency: Human-friendly explanation of scopes before consent.

Data Minimization
- Only fetch messages within selected time range and included labels/folders.
- Parse MIME/HTML locally; never upload raw content to third parties.

Keys & Config
- Developer-managed keys for LLMs and third-party APIs; embedded in application for proof-of-concept.
- Remote LLM usage operates with developer keys; user data redaction applied before external calls.

Sharing
- No central hosting. Share via encrypted file, encrypted URL, or user’s Drive/OneDrive. Deleting the artifact revokes access.

