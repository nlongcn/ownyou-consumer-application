# Session Keys Implementation Guide

## Why Session Keys Matter

**Problem**: Users hate signing every transaction. For apps with frequent transactions (games, trading, AI agents), requiring signature popups for each action kills UX.

**Solution**: Session keys allow users to sign once, granting temporary permissions to an ephemeral key that can sign multiple transactions within defined constraints.

**Key Benefits**:
- ✅ No popup fatigue (sign once, transact many times)
- ✅ Automated workflows (background transactions, AI agent actions)
- ✅ Better UX (feels like Web2 app)
- ✅ Security maintained (time-bound, spending limits, scope restrictions)

---

## Three Implementation Approaches

### Approach 1: Native Provider Session Keys (Easiest)

**Providers**: Privy, Dynamic, Sequence, Particle, Openfort

**How It Works**:
- Provider's SDK has built-in session key support
- No third-party integration needed
- Configuration via provider dashboard

**Privy Example**:
```typescript
import { usePrivy, useWallets } from '@privy-io/react-auth';

function App() {
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

  // Create session - user signs ONCE
  const createSession = async () => {
    await embeddedWallet.loginWithSession({
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
  };

  // Now can sign multiple transactions WITHOUT popup
  const makeTransaction = async () => {
    const provider = await embeddedWallet.getEthersProvider();
    const signer = provider.getSigner();

    // No popup! Uses session key
    const tx = await signer.sendTransaction({
      to: '0x...',
      value: ethers.utils.parseEther('0.01')
    });
  };

  return (
    <button onClick={createSession}>Enable Auto-Sign (24h)</button>
  );
}
```

**Dynamic Example**:
```typescript
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

function App() {
  const { primaryWallet } = useDynamicContext();

  // Enable session key
  const enableSessionKey = async () => {
    await primaryWallet.connector.enableSessionKey({
      duration: 86400, // 24 hours in seconds
      permissions: ['eth_sendTransaction', 'personal_sign']
    });
  };

  // Transactions now use session key automatically
  const sendTx = async () => {
    const walletClient = await primaryWallet.getWalletClient();
    await walletClient.sendTransaction({
      to: '0x...',
      value: parseEther('0.01')
    });
  };
}
```

**Sequence Example** (gaming-focused):
```typescript
import { sequence } from '0xsequence';

// Initialize with session key support
const wallet = await sequence.initWallet('polygon', {
  sessionKeys: {
    enabled: true,
    duration: 3600, // 1 hour for gaming session
  }
});

// Create session when player logs in
await wallet.openSession({
  expiresAt: Date.now() + 3600000,
  permissions: {
    // Only allow transactions to game contract
    contracts: ['0xGameContract'],
    // Spending limit
    maxGasPrice: '50 gwei',
  }
});

// Player can now transact freely within session
await wallet.sendTransaction({
  to: '0xGameContract',
  data: '0x...' // Mint NFT, trade cards, etc.
});
```

**Pros**:
- ✅ Fastest implementation (minutes)
- ✅ Provider handles security
- ✅ Well-tested, production-ready

**Cons**:
- ❌ Limited to provider's feature set
- ❌ Less granular control
- ❌ Vendor lock-in

**When to Use**: Most use cases. Start here unless you need advanced features.

---

### Approach 2: ZeroDev/Kernel Plugin (Most Flexible)

**Providers**: Works with ANY signer (Privy, Web3Auth, Magic, EOAs, etc.)

**How It Works**:
- ZeroDev provides smart contract wallet (ERC-4337)
- Session Key Plugin adds permissions layer
- Onchain validation of session key permissions
- ERC-7715 compliant

**Key Advantages**:
- ✅ Works with any wallet provider
- ✅ Granular permissions (spending limits, target contracts, time bounds)
- ✅ Onchain validation (security)
- ✅ ERC-7715 standard (future-proof)

**Architecture**:
```
User's EOA/Embedded Wallet (Privy, Web3Auth, etc.)
  ↓
ZeroDev Smart Account (ERC-4337)
  ↓
Session Key Plugin (granular permissions)
  ↓
Transactions executed with session key
```

**Implementation**:

```bash
npm install @zerodev/sdk @zerodev/session-keys permissionless viem
```

```typescript
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk';
import { SessionKeyPlugin } from '@zerodev/session-keys';
import { http, createPublicClient, parseEther } from 'viem';
import { sepolia } from 'viem/chains';

// Step 1: Create smart account with session key plugin
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://rpc.ankr.com/eth_sepolia')
});

// Connect with any signer (e.g., Privy)
const { authenticated, user } = usePrivy();
const embeddedWalletSigner = await getPrivySigner();

// Create Kernel account with session key plugin
const sessionKeyPlugin = await SessionKeyPlugin.init({
  signer: embeddedWalletSigner,
  sessionKey: generateSessionKey(), // Ephemeral key
  permissions: {
    // Time bound
    validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    validAfter: Math.floor(Date.now() / 1000),

    // Spending limit
    spendingLimits: [{
      token: '0x0000000000000000000000000000000000000000', // ETH
      allowance: parseEther('0.1'), // Max 0.1 ETH per day
    }],

    // Contract whitelist
    contractAddresses: [
      '0xYourDAppContract', // Only allow txs to your contract
    ],

    // Function selector whitelist (optional)
    functionSelectors: [
      '0xa9059cbb', // ERC20 transfer
      '0x095ea7b3', // ERC20 approve
    ],
  }
});

const kernelAccount = await createKernelAccount(publicClient, {
  signer: embeddedWalletSigner,
  plugins: {
    sudo: sessionKeyPlugin,
  },
});

const kernelClient = createKernelAccountClient({
  account: kernelAccount,
  chain: sepolia,
  transport: http('https://rpc.ankr.com/eth_sepolia'),
  sponsorUserOperation: async ({ userOperation }) => {
    // Optional: Add paymaster for gas sponsorship
    return paymasterClient.sponsorUserOperation({ userOperation });
  },
});

// Step 2: User signs ONCE to enable session key
const sessionKeyHash = await kernelClient.enableSessionKey({
  sessionKey: sessionKeyPlugin,
});

// Step 3: Store session key securely (localStorage, secure storage)
localStorage.setItem('sessionKeyHash', sessionKeyHash);

// Step 4: Later, use session key to sign transactions (NO POPUP)
const sessionClient = createKernelAccountClient({
  account: kernelAccount,
  sessionKey: sessionKeyPlugin,
  chain: sepolia,
  transport: http('https://rpc.ankr.com/eth_sepolia'),
});

// Send transaction without user signature popup
const txHash = await sessionClient.sendUserOperation({
  to: '0xYourDAppContract',
  data: encodeFunctionData({
    abi: YourContractABI,
    functionName: 'mint',
    args: [tokenId],
  }),
  value: parseEther('0.01'),
});

// Wait for transaction
const receipt = await sessionClient.waitForUserOperationReceipt({
  hash: txHash,
});
```

**Advanced: Per-Transaction Limits**:
```typescript
// Limit to 10 transactions per day
permissions: {
  validUntil: Math.floor(Date.now() / 1000) + 86400,
  callGasLimit: 10, // Max 10 calls
  spendingLimits: [{
    token: '0x...USDC',
    allowance: parseUnits('100', 6), // Max 100 USDC total
  }],
}
```

**Advanced: Key Rotation**:
```typescript
// Rotate session key without changing permissions
const newSessionKey = generateSessionKey();
await sessionKeyPlugin.updateSessionKey({
  oldKey: currentSessionKey,
  newKey: newSessionKey,
  // Permissions remain the same
});
```

**Pros**:
- ✅ Most flexible (granular permissions)
- ✅ Works with any wallet provider
- ✅ Onchain validation (security)
- ✅ ERC-7715 compliant
- ✅ No vendor lock-in

**Cons**:
- ❌ More complex setup
- ❌ Requires understanding ERC-4337
- ❌ Gas costs for smart account deployment

**When to Use**:
- Need granular permissions (spending limits, contract whitelists)
- Want to work with any wallet provider
- Building high-value transactions (DeFi, NFTs)
- Need future-proof standard (ERC-7715)

---

### Approach 3: Custom Implementation (Full Control)

**Warning**: ⚠️ Security-critical. Easy to get wrong. Only use if you have security expertise.

**How It Works**:
1. Generate ephemeral key pair on client
2. User signs delegation message with main wallet
3. Backend validates delegation signature
4. Ephemeral key signs transactions
5. Backend verifies both signatures before executing

**Basic Flow**:
```typescript
// 1. Generate ephemeral session key
const sessionKeyPair = ethers.Wallet.createRandom();
const sessionPublicKey = sessionKeyPair.address;

// 2. User signs delegation message
const delegationMessage = {
  sessionPublicKey: sessionPublicKey,
  expiresAt: Date.now() + 86400000, // 24 hours
  permissions: ['transfer', 'approve'],
  nonce: generateNonce(),
};

const mainWallet = await getMainWallet(); // Privy, Web3Auth, etc.
const delegationSignature = await mainWallet.signMessage(
  JSON.stringify(delegationMessage)
);

// 3. Store session key securely
localStorage.setItem('sessionKey', sessionKeyPair.privateKey);
localStorage.setItem('delegation', JSON.stringify({
  message: delegationMessage,
  signature: delegationSignature,
}));

// 4. Later, sign transaction with session key
const tx = {
  to: '0x...',
  value: ethers.utils.parseEther('0.01'),
  nonce: await provider.getTransactionCount(mainWallet.address),
};

const sessionWallet = new ethers.Wallet(sessionKeyPair.privateKey);
const sessionSignature = await sessionWallet.signTransaction(tx);

// 5. Send to backend for validation + execution
await fetch('/api/execute-session-tx', {
  method: 'POST',
  body: JSON.stringify({
    tx,
    sessionSignature,
    delegation: {
      message: delegationMessage,
      signature: delegationSignature,
    },
  }),
});
```

**Backend Validation** (critical security):
```typescript
// Backend must verify:
// 1. Delegation signature is valid
// 2. Session key is authorized
// 3. Delegation hasn't expired
// 4. Transaction is within permissions
// 5. Nonce hasn't been replayed

async function validateSessionTransaction(req) {
  const { tx, sessionSignature, delegation } = req.body;

  // 1. Recover main wallet address from delegation signature
  const mainAddress = ethers.utils.verifyMessage(
    JSON.stringify(delegation.message),
    delegation.signature
  );

  // 2. Check delegation hasn't expired
  if (Date.now() > delegation.message.expiresAt) {
    throw new Error('Session expired');
  }

  // 3. Recover session key address from transaction signature
  const sessionAddress = ethers.utils.recoverAddress(
    ethers.utils.keccak256(ethers.utils.serialize(tx)),
    sessionSignature
  );

  // 4. Verify session key matches delegated key
  if (sessionAddress !== delegation.message.sessionPublicKey) {
    throw new Error('Invalid session key');
  }

  // 5. Check transaction is within permissions
  // (implement based on your permission model)

  // 6. Check nonce hasn't been used (prevent replay)
  if (await isNonceUsed(delegation.message.nonce)) {
    throw new Error('Nonce already used');
  }
  await markNonceUsed(delegation.message.nonce);

  // 7. Execute transaction from main wallet
  const mainWallet = new ethers.Wallet(process.env.HOT_WALLET_KEY, provider);
  const executedTx = await mainWallet.sendTransaction(tx);

  return executedTx.hash;
}
```

**Security Considerations**:
- ❌ **Don't** store session keys in localStorage (XSS risk) → Use secure storage
- ❌ **Don't** skip nonce validation (replay attacks)
- ❌ **Don't** skip expiration checks
- ❌ **Don't** allow arbitrary permissions
- ✅ **Do** use HTTPS only
- ✅ **Do** implement rate limiting
- ✅ **Do** log all session key usage
- ✅ **Do** allow users to revoke sessions

**Pros**:
- ✅ Full control over implementation
- ✅ Custom permission models
- ✅ No third-party dependencies

**Cons**:
- ❌ High security risk if done wrong
- ❌ Requires extensive backend logic
- ❌ No standard (hard to audit)
- ❌ Maintenance burden

**When to Use**:
- Only if you have experienced security engineers
- Need truly custom permission models
- Can afford extensive security audits

---

## Best Practices

### 1. Always Set Expiration Times
```typescript
// ✅ Good: Session expires after 24 hours
expiresAt: Date.now() + 86400000

// ❌ Bad: No expiration (security risk)
expiresAt: null
```

### 2. Implement Spending Limits
```typescript
// ✅ Good: Limit daily spending
spendingLimits: [{
  token: ETH_ADDRESS,
  allowance: parseEther('0.1'), // Max 0.1 ETH
  period: 86400, // Per day
}]

// ❌ Bad: Unlimited spending
spendingLimits: []
```

### 3. Whitelist Contracts
```typescript
// ✅ Good: Only allow known contracts
contractAddresses: [GAME_CONTRACT, MARKETPLACE_CONTRACT]

// ❌ Bad: Allow any contract
contractAddresses: ['*']
```

### 4. Store Keys Securely
```typescript
// ✅ Good: Use secure storage on mobile
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  await SecureStore.setItemAsync('sessionKey', key);
}

// ❌ Bad: Plain localStorage (XSS risk)
localStorage.setItem('sessionKey', key);
```

### 5. Allow Session Revocation
```typescript
const revokeSession = async () => {
  // Clear local storage
  localStorage.removeItem('sessionKey');

  // Revoke onchain (if using smart account)
  await kernelClient.disableSessionKey(sessionKeyHash);

  // Invalidate on backend
  await fetch('/api/revoke-session', {
    method: 'POST',
    body: JSON.stringify({ sessionKeyHash }),
  });
};
```

### 6. Show Session Status to Users
```tsx
function SessionStatus() {
  const { sessionKey, expiresAt } = useSessionKey();

  if (!sessionKey) {
    return <button onClick={createSession}>Enable Auto-Sign</button>;
  }

  return (
    <div>
      <p>✅ Auto-sign enabled</p>
      <p>Expires: {new Date(expiresAt).toLocaleString()}</p>
      <p>Remaining: {getRemainingTime(expiresAt)}</p>
      <button onClick={revokeSession}>Revoke Access</button>
    </div>
  );
}
```

---

## Use Case Patterns

### Gaming: Short Sessions with Contract Whitelisting
```typescript
// 1-hour gaming session, only game contract
permissions: {
  validUntil: now + 3600,
  contractAddresses: [GAME_CONTRACT],
  functionSelectors: [
    MINT_NFT,
    TRADE_CARD,
    CLAIM_REWARD
  ],
  spendingLimits: [{ token: ETH, allowance: '0.05 ETH' }],
}
```

### Trading: Time-Bound with Price Limits
```typescript
// 24-hour trading session, max $1000 per day
permissions: {
  validUntil: now + 86400,
  contractAddresses: [DEX_CONTRACT, SWAP_ROUTER],
  spendingLimits: [
    { token: USDC, allowance: '1000 USDC', period: 86400 },
  ],
  // Require user signature for large trades
  requireConfirmation: (tx) => tx.value > parseUnits('100', 6),
}
```

### AI Agent: Long-Term with Daily Limits
```typescript
// 30-day agent session, small daily limit
permissions: {
  validUntil: now + 30 * 86400,
  spendingLimits: [
    { token: ETH, allowance: '0.01 ETH', period: 86400 },
  ],
  // Agent can only interact with approved contracts
  contractAddresses: [SHOPPING_CONTRACT, SAVINGS_CONTRACT],
  // Notify user of daily spending
  webhooks: {
    onTransaction: 'https://api.myapp.com/notify-user'
  },
}
```

### Subscription: Fixed-Amount Recurring
```typescript
// Allow $10/month subscription payment
permissions: {
  validUntil: now + 365 * 86400, // 1 year
  spendingLimits: [
    {
      token: USDC,
      allowance: '10 USDC',
      period: 30 * 86400, // Per month
    },
  ],
  // Only allow payment to subscription contract
  contractAddresses: [SUBSCRIPTION_CONTRACT],
  functionSelectors: [PAY_SUBSCRIPTION],
}
```

---

## ERC-7715 Compatibility

**ERC-7715** is the emerging standard for wallet permissions. If building for the future, consider ERC-7715-compliant implementations.

**Key Concepts**:
- Standard `wallet_grantPermissions` method
- Portable permissions across wallets
- Clear UX for permission requests

**Example** (MetaMask Delegation Toolkit):
```typescript
const permissions = await window.ethereum.request({
  method: 'wallet_grantPermissions',
  params: [{
    eth_accounts: {},
    permitted_calls: [
      {
        address: '0xGameContract',
        abi: [{ name: 'mint', ... }],
      }
    ],
    expiry: Math.floor(Date.now() / 1000) + 3600,
  }],
});

// Use granted permissions to execute transactions
await delegationToolkit.execute({
  permissions,
  calls: [{
    to: '0xGameContract',
    data: encodeFunctionData({ functionName: 'mint', args: [tokenId] }),
  }],
});
```

**Providers Supporting ERC-7715**:
- MetaMask Delegation Toolkit (pioneering)
- ZeroDev/Kernel (via plugin)
- Expected: Privy, Dynamic, others (coming soon)

---

## Troubleshooting

### "Session expired" error
**Cause**: Session key validity period ended
**Fix**: Re-create session with user signature

### "Permission denied" error
**Cause**: Transaction violates session key permissions
**Fix**: Check spending limits, contract whitelist, function selectors

### "Nonce too low" error
**Cause**: Transaction nonce conflict
**Fix**: Use proper nonce management, increment per transaction

### Session keys not persisting across page reloads
**Cause**: Not storing in persistent storage
**Fix**: Use localStorage (web) or SecureStore (mobile)

### User can't revoke session
**Cause**: No revocation mechanism implemented
**Fix**: Add revoke button that clears keys + invalidates onchain

---

## Security Checklist

Before deploying session keys:

- [ ] Set expiration times (max 7 days recommended)
- [ ] Implement spending limits
- [ ] Whitelist allowed contracts
- [ ] Store keys securely (not plain localStorage)
- [ ] Implement nonce validation (prevent replay)
- [ ] Allow user revocation
- [ ] Log all session key usage
- [ ] Rate limit session creation
- [ ] Show clear UX (active sessions, expiration)
- [ ] Test session expiration flows
- [ ] Audit permission validation logic
- [ ] Implement monitoring/alerts for suspicious activity

---

## Further Reading

- [ZeroDev Session Keys Docs](https://docs.zerodev.app/sdk/permissions/intro)
- [ERC-7715 Specification](https://eips.ethereum.org/EIPS/eip-7715)
- [MetaMask Delegation Toolkit](https://docs.metamask.io/delegation-toolkit/)
- [Privy Session Keys Guide](https://docs.privy.io/)
- [Dynamic Session Keys](https://docs.dynamic.xyz/docs/session-keys)
