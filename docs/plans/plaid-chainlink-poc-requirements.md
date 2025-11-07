# Plaid + Chainlink POC Requirements

**Status:** POC / Separate Development Track
**Integration Target:** Phase 7 (Production & Polish)
**Duration:** 2-3 weeks
**Complexity:** HIGH (Pioneering work, no production examples)

---

## 🎯 Goal

Build a **proof-of-concept** for self-sovereign financial data integration using Plaid + Chainlink Functions, where:
- User controls encryption keys via wallet
- access_tokens stored in user-controlled decentralized storage (Ceramic Network)
- OwnYou backend NEVER sees plaintext access_tokens
- Frontend fetches financial data directly from Plaid (no backend proxy)

**Critical Success Criteria:** Zero trust in OwnYou backend for financial data access.

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S DEVICE                         │
├─────────────────────────────────────────────────────────┤
│  1. User clicks "Connect Bank Account"                  │
│  2. Plaid Link opens (bank login)                       │
│  3. Receives public_token                               │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│              BLOCKCHAIN (Polygon/Arbitrum)              │
├─────────────────────────────────────────────────────────┤
│  4. Frontend calls PlaidConsumer.sol smart contract     │
│  5. Smart contract requests Chainlink Function          │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│           CHAINLINK DON (Decentralized Oracle)          │
├─────────────────────────────────────────────────────────┤
│  6. DON executes JavaScript function (token exchange)   │
│  7. Calls Plaid API with encrypted client_secret        │
│  8. Receives access_token + item_id                     │
│  9. Encrypts access_token with user's public key        │
│  10. Returns encrypted token to smart contract          │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│        CERAMIC NETWORK (User-Controlled Storage)        │
├─────────────────────────────────────────────────────────┤
│  11. Frontend stores encrypted token in Ceramic         │
│  12. User's DID controls access (wallet-based)          │
└──────────────┬──────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────┐
│         SUBSEQUENT DATA FETCHES (User Device)           │
├─────────────────────────────────────────────────────────┤
│  13. Frontend retrieves encrypted token from Ceramic    │
│  14. Decrypts with wallet private key (client-side)     │
│  15. Calls Plaid API directly with access_token         │
│  16. Processes transactions locally                     │
│  17. Writes to local LangGraph Store                    │
└─────────────────────────────────────────────────────────┘

NO OWNYOU BACKEND INVOLVEMENT ✅
```

---

## 📦 Components to Build

### 1. Chainlink Function (JavaScript)

**File:** `chainlink-functions/plaid-token-exchange.js`

```javascript
/**
 * Chainlink Function: Exchange Plaid public_token for access_token
 *
 * Secrets (encrypted on DON):
 * - PLAID_CLIENT_ID
 * - PLAID_SECRET
 *
 * Args:
 * - public_token (string): From Plaid Link
 * - user_public_key (string): User's wallet public key for encryption
 *
 * Returns:
 * - encrypted_access_token (string): Encrypted with user's public key
 * - item_id (string): Plaid item identifier
 */

// Import crypto library (available in Chainlink Functions runtime)
const { encrypt } = Functions.makeHttpRequest;

// 1. Exchange public_token for access_token
const plaidResponse = await Functions.makeHttpRequest({
  url: "https://sandbox.plaid.com/item/public_token/exchange",
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  data: {
    client_id: secrets.PLAID_CLIENT_ID,
    secret: secrets.PLAID_SECRET,
    public_token: args[0]  // public_token from user
  }
});

if (!plaidResponse.data || plaidResponse.data.error_code) {
  throw Error(`Plaid API error: ${JSON.stringify(plaidResponse.data)}`);
}

const { access_token, item_id } = plaidResponse.data;

// 2. Encrypt access_token with user's public key
const userPublicKey = args[1];
const encryptedToken = await encryptWithPublicKey(access_token, userPublicKey);

// 3. Return encrypted token + item_id
return Functions.encodeString(
  JSON.stringify({
    encrypted_access_token: encryptedToken,
    item_id: item_id
  })
);

// Helper: Encrypt data with public key
async function encryptWithPublicKey(data, publicKeyHex) {
  // Use ECIES (Elliptic Curve Integrated Encryption Scheme)
  // Compatible with web3.js encryption
  const { encrypt } = await import("@metamask/eth-sig-util");

  const encrypted = encrypt({
    publicKey: publicKeyHex,
    data: data,
    version: "x25519-xsalsa20-poly1305"
  });

  return JSON.stringify(encrypted);
}
```

**Deployment:**
```bash
# Upload to Chainlink Functions
npx hardhat functions-deploy-function \
  --network polygon-mumbai \
  --verify true
```

---

### 2. Smart Contract (Solidity)

**File:** `contracts/PlaidConsumer.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title PlaidConsumer
 * @notice Smart contract for exchanging Plaid public_token via Chainlink Functions
 * @dev Users call requestTokenExchange(), Chainlink DON executes, callback stores result
 */
contract PlaidConsumer is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    // Events
    event TokenExchangeRequested(bytes32 indexed requestId, address indexed user);
    event TokenExchangeFulfilled(bytes32 indexed requestId, string itemId);

    // Chainlink Functions configuration
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 300000;

    // Request tracking
    mapping(bytes32 => address) public requestIdToUser;
    mapping(address => bytes32) public userToLatestRequest;

    // Results (encrypted tokens NOT stored onchain for privacy)
    // Only emit event with item_id for tracking
    mapping(address => string) public userToItemId;

    constructor(
        address router,
        bytes32 _donId,
        uint64 _subscriptionId
    ) FunctionsClient(router) {
        donId = _donId;
        subscriptionId = _subscriptionId;
    }

    /**
     * @notice Request Plaid token exchange via Chainlink Functions
     * @param publicToken Plaid public_token from Link
     * @param userPublicKey User's wallet public key for encryption
     * @param source JavaScript source code for token exchange
     */
    function requestTokenExchange(
        string calldata publicToken,
        string calldata userPublicKey,
        string calldata source
    ) external returns (bytes32 requestId) {
        // Build Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);

        // Add arguments
        string[] memory args = new string[](2);
        args[0] = publicToken;
        args[1] = userPublicKey;
        req.setArgs(args);

        // Send request to Chainlink DON
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        // Track request
        requestIdToUser[requestId] = msg.sender;
        userToLatestRequest[msg.sender] = requestId;

        emit TokenExchangeRequested(requestId, msg.sender);
    }

    /**
     * @notice Callback from Chainlink Functions (DON calls this)
     * @param requestId Chainlink request ID
     * @param response Encrypted access_token + item_id (JSON)
     * @param err Error message if any
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        require(requestIdToUser[requestId] != address(0), "Invalid request");

        if (err.length > 0) {
            // Log error, don't revert (allow user to retry)
            return;
        }

        // Decode response
        string memory responseStr = string(response);
        (string memory itemId) = abi.decode(abi.encodePacked(responseStr), (string));

        // Store item_id onchain (NOT access_token!)
        address user = requestIdToUser[requestId];
        userToItemId[user] = itemId;

        emit TokenExchangeFulfilled(requestId, itemId);

        // NOTE: encrypted_access_token is in response but NOT stored onchain
        // Frontend retrieves it from the transaction logs
    }

    /**
     * @notice Get item_id for user (if exchange completed)
     */
    function getItemId(address user) external view returns (string memory) {
        return userToItemId[user];
    }
}
```

**Deployment:**
```bash
npx hardhat deploy --network polygon-mumbai --tags PlaidConsumer
```

---

### 3. Frontend Integration (TypeScript)

**File:** `src/integrations/plaid-chainlink.ts`

```typescript
import { ethers } from 'ethers';
import { usePlaidLink } from 'react-plaid-link';
import CeramicClient from '@ceramicnetwork/http-client';
import { DID } from 'dids';

/**
 * Connect bank account via Plaid + Chainlink
 */
export async function connectBankAccount(
  wallet: ethers.Wallet,
  plaidLinkToken: string
): Promise<{ itemId: string; ceramicDocId: string }> {
  // 1. Open Plaid Link
  const { open, ready } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess: async (public_token, metadata) => {
      console.log('Plaid Link success:', metadata);

      // 2. Get user's public key for encryption
      const publicKey = wallet.publicKey;

      // 3. Call smart contract to request token exchange
      const contract = new ethers.Contract(
        PLAID_CONSUMER_ADDRESS,
        PlaidConsumerABI,
        wallet
      );

      const tx = await contract.requestTokenExchange(
        public_token,
        publicKey,
        CHAINLINK_FUNCTION_SOURCE  // JavaScript code from step 1
      );

      const receipt = await tx.wait();

      // 4. Listen for fulfillment event
      const fulfillEvent = receipt.events?.find(
        (e) => e.event === 'TokenExchangeFulfilled'
      );

      if (!fulfillEvent) {
        throw new Error('Token exchange failed');
      }

      // 5. Extract encrypted token from transaction logs
      const requestId = fulfillEvent.args.requestId;
      const encryptedToken = await getEncryptedTokenFromLogs(requestId);

      // 6. Store encrypted token in Ceramic Network
      const ceramic = new CeramicClient('https://ceramic.network');
      const did = new DID({ provider: wallet, resolver: /* ... */ });

      const doc = await ceramic.createDocument('tile', {
        content: {
          encrypted_access_token: encryptedToken,
          item_id: fulfillEvent.args.itemId,
          created_at: Date.now()
        },
        metadata: {
          controllers: [did.id],  // Only user can access
          family: 'ownyou-plaid-tokens'
        }
      });

      return {
        itemId: fulfillEvent.args.itemId,
        ceramicDocId: doc.id.toString()
      };
    }
  });

  if (ready) {
    open();
  }
}

/**
 * Fetch transactions from Plaid (subsequent calls)
 */
export async function fetchPlaidTransactions(
  wallet: ethers.Wallet,
  ceramicDocId: string,
  startDate: string,
  endDate: string
): Promise<PlaidTransaction[]> {
  // 1. Retrieve encrypted token from Ceramic
  const ceramic = new CeramicClient('https://ceramic.network');
  const doc = await ceramic.loadDocument(ceramicDocId);

  const encryptedToken = doc.content.encrypted_access_token;

  // 2. Decrypt with wallet private key (client-side only)
  const decrypted = await wallet.decrypt(encryptedToken);
  const access_token = decrypted.toString('utf8');

  // 3. Call Plaid API directly (NO backend proxy)
  const response = await fetch('https://sandbox.plaid.com/transactions/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,  // Public, safe to expose
      secret: access_token,  // User's access_token (decrypted locally)
      access_token: access_token,
      start_date: startDate,
      end_date: endDate
    })
  });

  const data = await response.json();

  // 4. Clear token from memory immediately
  access_token = null;
  decrypted.fill(0);

  return data.transactions;
}

// Helper: Extract encrypted token from Chainlink response logs
async function getEncryptedTokenFromLogs(requestId: string): Promise<string> {
  // Query blockchain for fulfillRequest transaction
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const filter = {
    address: PLAID_CONSUMER_ADDRESS,
    topics: [ethers.utils.id('TokenExchangeFulfilled(bytes32,string)')]
  };

  const logs = await provider.getLogs(filter);
  const log = logs.find((l) => l.topics[1] === requestId);

  if (!log) {
    throw new Error('Fulfillment log not found');
  }

  // Decode log data (contains encrypted_access_token)
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ['string', 'string'],
    log.data
  );

  return decoded[0];  // encrypted_access_token
}
```

---

### 4. Ceramic Network Integration

**Setup:**
```bash
npm install @ceramicnetwork/http-client dids key-did-provider-ed25519
```

**Configuration:**
```typescript
import { CeramicClient } from '@ceramicnetwork/http-client';
import { DID } from 'dids';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import { getResolver } from 'key-did-resolver';

// Initialize Ceramic client
const ceramic = new CeramicClient('https://ceramic.network');

// Create DID from wallet
const seed = ethers.utils.arrayify(wallet.privateKey);
const provider = new Ed25519Provider(seed);

const did = new DID({
  provider,
  resolver: getResolver()
});

await did.authenticate();
ceramic.did = did;
```

**Document Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PlaidTokenDocument",
  "type": "object",
  "properties": {
    "encrypted_access_token": {
      "type": "string",
      "description": "Encrypted Plaid access_token (ECIES)"
    },
    "item_id": {
      "type": "string",
      "description": "Plaid item identifier"
    },
    "institution": {
      "type": "string",
      "description": "Bank name (e.g., Chase, Wells Fargo)"
    },
    "created_at": {
      "type": "number",
      "description": "Unix timestamp"
    },
    "last_synced": {
      "type": "number",
      "description": "Last successful transaction fetch"
    }
  },
  "required": ["encrypted_access_token", "item_id", "created_at"]
}
```

---

## 🧪 Testing Strategy

### 1. Local Testing (Hardhat + Chainlink Functions Simulator)

```bash
# Start local Hardhat node
npx hardhat node

# Deploy contracts
npx hardhat deploy --network localhost

# Simulate Chainlink Functions locally
npx hardhat functions-simulate \
  --network localhost \
  --contract PlaidConsumer \
  --function requestTokenExchange
```

### 2. Testnet Testing (Polygon Mumbai)

**Prerequisites:**
- Mumbai testnet MATIC (faucet: https://faucet.polygon.technology/)
- Chainlink Functions subscription (https://functions.chain.link/)
- Plaid Sandbox credentials

**Test Flow:**
```typescript
describe('Plaid + Chainlink Integration', () => {
  it('should exchange token via Chainlink Functions', async () => {
    // 1. Get Plaid Link token (sandbox)
    const linkToken = await getPlaidLinkToken();

    // 2. Simulate Plaid Link (get public_token)
    const publicToken = await simulatePlaidLink(linkToken);

    // 3. Call smart contract
    const tx = await plaidConsumer.requestTokenExchange(
      publicToken,
      wallet.publicKey,
      chainlinkFunctionSource
    );

    const receipt = await tx.wait();

    // 4. Verify fulfillment event
    const event = receipt.events.find((e) => e.event === 'TokenExchangeFulfilled');
    expect(event).toBeDefined();
    expect(event.args.itemId).toBeTruthy();

    // 5. Verify encrypted token retrievable
    const encryptedToken = await getEncryptedTokenFromLogs(event.args.requestId);
    expect(encryptedToken).toBeTruthy();

    // 6. Decrypt and verify
    const decrypted = await wallet.decrypt(encryptedToken);
    expect(decrypted.startsWith('access-sandbox-')).toBe(true);  // Plaid sandbox format
  });

  it('should store encrypted token in Ceramic', async () => {
    const { ceramicDocId } = await connectBankAccount(wallet, linkToken);

    // Verify document created
    const doc = await ceramic.loadDocument(ceramicDocId);
    expect(doc.content.encrypted_access_token).toBeDefined();
    expect(doc.metadata.controllers).toContain(wallet.did);
  });

  it('should fetch transactions directly from Plaid', async () => {
    const transactions = await fetchPlaidTransactions(
      wallet,
      ceramicDocId,
      '2025-01-01',
      '2025-01-31'
    );

    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0]).toHaveProperty('amount');
    expect(transactions[0]).toHaveProperty('merchant_name');
  });
});
```

---

## 🔒 Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **OwnYou backend compromise** | ✅ Backend never sees access_token (encrypted with user's key) |
| **Chainlink DON compromise** | ⚠️ DON sees plaintext access_token during exchange (trust Chainlink security) |
| **Ceramic Network breach** | ✅ Tokens encrypted, attacker needs user's private key |
| **User device compromise** | ⚠️ Attacker with private key can decrypt tokens (same risk as wallet) |
| **Plaid API key leak** | ✅ Encrypted on DON, never exposed to frontend |
| **Smart contract exploit** | ✅ No funds at risk, only access_token (revocable via Plaid) |

### Best Practices

1. **Minimize plaintext exposure:**
   - Decrypt access_token in-memory only
   - Clear from memory immediately after use
   - Never log plaintext tokens

2. **User control:**
   - User can revoke Plaid access anytime (Plaid dashboard)
   - User can delete Ceramic document
   - User can rotate encryption keys

3. **Monitoring:**
   - Log Chainlink request IDs for debugging
   - Alert on failed token exchanges
   - Track Plaid API error rates

---

## 📋 Prerequisites

### Development Tools
- Node.js 18+
- Hardhat
- ethers.js v6
- Chainlink Functions CLI

### Services & Accounts
1. **Plaid:**
   - Sign up: https://dashboard.plaid.com/signup
   - Create Sandbox credentials
   - Note: Production requires Plaid approval

2. **Chainlink Functions:**
   - Create subscription: https://functions.chain.link/
   - Fund with LINK tokens (testnet: faucet)
   - Note DON ID for your network

3. **Ceramic Network:**
   - Use public node: https://ceramic.network
   - OR self-host: https://developers.ceramic.network/run/nodes/

4. **Polygon Mumbai:**
   - Testnet MATIC: https://faucet.polygon.technology/
   - RPC URL: https://rpc-mumbai.maticvigil.com/

---

## 🚀 POC Success Criteria

### Must Have ✅
- [  ] Smart contract deployed on Mumbai testnet
- [  ] Chainlink Function successfully exchanges Plaid token
- [  ] Encrypted access_token stored in Ceramic Network
- [  ] Frontend can decrypt and fetch transactions
- [  ] Zero plaintext tokens reach OwnYou backend
- [  ] Unit tests passing (80%+ coverage)
- [  ] Integration test passing (E2E flow)

### Nice to Have 🎯
- [  ] Gas optimization (< 0.01 MATIC per exchange)
- [  ] Error recovery (retry on DON failure)
- [  ] Multi-device support (same Ceramic doc)
- [  ] Token refresh flow (when access_token expires)
- [  ] Plaid webhook integration (transaction updates)

---

## 🔗 Integration with Main App (Phase 7)

### Plugin Architecture

**Interface Contract:**
```typescript
// src/integrations/financial-connector.ts
export interface FinancialConnector {
  connect(): Promise<void>;
  getTransactions(startDate: string, endDate: string): Promise<Transaction[]>;
  getBalance(): Promise<Balance>;
  disconnect(): Promise<void>;
}

// Plaid + Chainlink implementation
export class PlaidChainlinkConnector implements FinancialConnector {
  async connect(): Promise<void> {
    const { ceramicDocId } = await connectBankAccount(wallet, linkToken);
    localStorage.setItem('plaid_ceramic_doc', ceramicDocId);
  }

  async getTransactions(start: string, end: string): Promise<Transaction[]> {
    const docId = localStorage.getItem('plaid_ceramic_doc');
    return await fetchPlaidTransactions(wallet, docId, start, end);
  }

  // ... other methods
}
```

**Registration in Phase 7:**
```typescript
// src/data-sources/registry.ts
import { PlaidChainlinkConnector } from '../integrations/plaid-chainlink';

export const DATA_SOURCE_REGISTRY = {
  email: EmailConnector,
  calendar: CalendarConnector,
  browsing: BrowserExtensionConnector,
  financial: PlaidChainlinkConnector,  // ← Plug in POC here
};
```

### Migration Path

**From POC to Production:**
1. **POC (Phase 2-6):** Standalone testing, sandbox only
2. **Phase 7 Integration:** Plug into main app via interface
3. **Production Launch:** Switch to Plaid Production API, mainnet deployment

**No code changes needed in main app** - clean plugin architecture.

---

## 📚 Resources

### Documentation
- **Plaid API:** https://plaid.com/docs/
- **Chainlink Functions:** https://docs.chain.link/chainlink-functions
- **Ceramic Network:** https://developers.ceramic.network/
- **ECIES Encryption:** https://github.com/sigp/ecies-ed25519

### Example Code
- Chainlink Functions examples: https://github.com/smartcontractkit/functions-examples
- Ceramic DID auth: https://did.js.org/
- Plaid quickstart: https://github.com/plaid/quickstart

### Costs (Testnet Free, Mainnet)
- **Chainlink DON call:** ~0.2 LINK (~$3)
- **Polygon gas (token exchange):** ~0.01 MATIC (~$0.01)
- **Ceramic writes:** Free (public node)
- **Plaid API:** $0 (sandbox), paid in production

---

## 🎯 Next Steps

### Week 1: Chainlink Functions Setup
- Day 1-2: Write JavaScript function for token exchange
- Day 3: Test locally with Hardhat Functions simulator
- Day 4-5: Deploy to Mumbai testnet, test E2E

### Week 2: Smart Contract + Ceramic
- Day 1-2: Write PlaidConsumer.sol
- Day 3: Deploy and verify on Mumbai
- Day 4-5: Integrate Ceramic Network for storage

### Week 3: Frontend Integration + Testing
- Day 1-2: Build React UI with Plaid Link
- Day 3: Connect to smart contract (ethers.js)
- Day 4-5: Write E2E tests, document findings

**Deliverable:** Working POC demonstrating full self-sovereign Plaid integration, ready to plug into main app in Phase 7.

---

**Last Updated:** 2025-11-06
**Status:** Ready to Start POC
**Integration Target:** Phase 7 (2-3 months from now)
