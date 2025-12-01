# OwnYou Desktop App - Setup & Architecture

**Status:** ✅ Day 1-2 Complete (Tauri Scaffold + MSAL OAuth)
**Last Updated:** 2025-01-17
**Framework:** Tauri v2 + TypeScript + Rust

---

## ✅ Completed (Day 1-2)

### 1. Tauri Project Scaffolding
- ✅ Rust toolchain installed (1.91.1)
- ✅ Tauri v2 project initialized
- ✅ Project structure created in `src/desktop-app/`
- ✅ Build system verified (compiles successfully)

### 2. MSAL OAuth Implementation
- ✅ OAuth 2.0 client with PKCE flow
- ✅ Microsoft authentication endpoints configured
- ✅ Token data structure with 90-day expiration
- ✅ Tauri commands for OAuth flow

### 3. Dependencies Configured
**Rust (Cargo.toml):**
- `tauri = "2"` - Core framework
- `tauri-plugin-store = "2"` - Persistent key-value storage
- `oauth2 = "4.4"` - OAuth 2.0 client library
- `reqwest = "0.12"` - HTTP client
- `tokio = "1"` - Async runtime
- `chrono = "0.4"` - Date/time handling
- `serde/serde_json` - Serialization

---

## 🏗️ Architecture

### Backend (Rust)
**Location:** `src-tauri/src/`

**Modules:**
1. **oauth.rs** - MSAL OAuth client
   - `MsalClient` - OAuth 2.0 client with PKCE
   - `TokenData` - Token structure with 90-day expiration
   - `is_token_expired()` - Token validation

2. **lib.rs** - Tauri commands
   - `start_oauth()` - Generate authorization URL
   - `complete_oauth()` - Exchange code for tokens
   - `refresh_access_token()` - Refresh expired tokens
   - `check_token_expiration()` - Validate token status

**Storage Strategy:**
- Tokens stored via **Tauri Store plugin** (frontend-managed)
- No backend keychain dependency
- Frontend uses `@tauri-apps/plugin-store` for persistent storage

### Frontend (TypeScript)
**Location:** `src/` (to be implemented)

**Planned Structure:**
```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { Store } from '@tauri-apps/plugin-store';

// Initialize store
const store = await Store.load('tokens.json');

// Start OAuth flow
const authUrl = await invoke('start_oauth', {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: null, // Optional for public clients
  redirectUri: 'http://localhost:8080/callback'
});

// Exchange authorization code for tokens
const tokens = await invoke('complete_oauth', {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: null,
  redirectUri: 'http://localhost:8080/callback',
  code: authorizationCode
});

// Store tokens
await store.set('microsoft_tokens', tokens);
await store.save();
```

---

## 🔐 OAuth Flow

### PKCE (Proof Key for Code Exchange)
1. **Generate Auth URL** - Backend creates PKCE challenge
2. **User Authorization** - Browser redirects to Microsoft
3. **Exchange Code** - Backend exchanges code + PKCE verifier for tokens
4. **Store Tokens** - Frontend stores in Tauri Store
5. **Refresh Tokens** - Use refresh_token before 90-day expiration

### Token Lifetime
- **Access Token:** ~1 hour (use immediately or refresh)
- **Refresh Token:** **90 days** (Microsoft default for delegated permissions)
- **Expiration Check:** 5-minute buffer built-in

---

## 📦 Build & Run

### Development

```bash
cd src/desktop-app

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Production Build

```bash
# Build for current platform
npm run tauri build

# Output:
# macOS: src-tauri/target/release/bundle/macos/
# Windows: src-tauri/target/release/bundle/msi/
# Linux: src-tauri/target/release/bundle/appimage/
```

---

## 🔧 Configuration

### Microsoft Azure App Registration
**Required Permissions:**
- `offline_access` - Refresh tokens
- `https://graph.microsoft.com/Mail.Read` - Email access
- `https://graph.microsoft.com/User.Read` - User profile

**Redirect URI:**
- Development: `http://localhost:8080/callback`
- Production: `ownyou://oauth/callback` (custom protocol)

**Application Type:** Public client (no client secret for desktop apps)

---

## 📋 Next Steps (Day 3-5)

### Day 3-4: Ceramic + Wallet Integration
- [ ] Set up Ceramic client in Rust
- [ ] Implement wallet integration (MetaMask)
- [ ] Test mission card write/read to Ceramic
- [ ] Add encryption with wallet-derived keys

### Day 5: Chrome Extension Bridge
- [ ] Implement native messaging protocol
- [ ] Test browser history capture
- [ ] Verify data flow: Extension → Desktop App → Ceramic

---

## 🚨 Security Notes

1. **No Client Secret** - Desktop apps use PKCE, not client secrets
2. **Token Storage** - Tauri Store encrypts data at rest
3. **90-Day Tokens** - Must refresh before expiration (check daily)
4. **Wallet Keys** - Derive encryption keys from MetaMask (deterministic)

---

## 🔗 References

- [Tauri Documentation](https://tauri.app/)
- [MSAL.js (JavaScript alternative)](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [Tauri Store Plugin](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store)

---

**Project:** OwnYou Consumer Application
**Repository:** `/Volumes/T7_new/developer_old/ownyou_consumer_application`
