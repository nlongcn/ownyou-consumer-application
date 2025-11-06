# Account Abstraction Standards Roadmap (2025)

## Quick Reference

**ERC-4337**: ✅ Live now (since March 2023)
**EIP-7702**: ✅ Live now (Pectra upgrade, May 7, 2025)
**ERC-7715**: 🚧 Draft (experimental, MetaMask leading)

---

## ERC-4337: Smart Contract Accounts (Current Standard)

**Status**: Production-ready, 25M+ accounts deployed

**What It Is**:
Application-layer account abstraction using UserOperations, bundlers, and paymasters.

**Key Components**:
- **UserOperation**: Transaction-like object with custom validation logic
- **Bundler**: Off-chain service that batches UserOps into single transaction
- **Paymaster**: Contract that sponsors gas fees for users
- **EntryPoint**: Single contract that processes all UserOps

**Advantages**:
✅ Live on all major chains (Ethereum, Polygon, Arbitrum, Optimism, Base, etc.)
✅ No hard fork required
✅ Rich features (gas sponsorship, batching, custom validation)
✅ Mature ecosystem (25M+ accounts, 132M UserOps processed)

**Trade-offs**:
⚠️ Additional gas overhead (15K-30K gas per UserOp for EntryPoint validation)
⚠️ Requires deploying smart contract wallet
⚠️ Not backwards compatible with EOAs

**When to Use**:
- **Now**: Need gas sponsorship, batch transactions, or session keys
- **Multi-chain**: Want consistent behavior across networks
- **Advanced features**: Need custom validation logic or paymasters

**Gas Costs**:
- Account deployment: ~200K gas
- UserOp overhead: ~20K gas additional per transaction
- Trade-off: Higher per-tx cost, but unlocks features impossible with EOAs

**Provider Support**: All major embedded wallet providers support ERC-4337

---

## EIP-7702: EOA Enhancement (New, May 2025)

**Status**: Live on Ethereum mainnet (Pectra upgrade, May 7, 2025)

**What It Is**:
New transaction type that lets EOAs temporarily delegate code execution to smart contracts.

**How It Works**:
```
1. User signs delegation message pointing to smart contract code
2. Transaction includes delegation signature
3. For this transaction only, EOA executes code as if it were smart contract
4. After transaction, EOA returns to normal
```

**Key Differences from ERC-4337**:
- ✅ **Backwards compatible**: Existing EOAs gain smart account features
- ✅ **No deployment cost**: No need to deploy separate smart wallet
- ✅ **Lower gas**: Native execution (no cross-contract calls)
- ✅ **Same address**: Users keep their existing address
- ⚠️ **Ethereum only**: Not available on L2s initially
- ⚠️ **Temporary**: Delegation only for single transaction

**Advantages**:
✅ Gradual adoption path (EOAs → smart features without migration)
✅ Lower gas costs than ERC-4337
✅ No separate account deployment
✅ Cross-chain address consistency

**Trade-offs**:
⚠️ Ethereum mainnet only (L2s need to adopt)
⚠️ Less mature ecosystem (launched May 2025)
⚠️ Requires new transaction type (not all wallets support yet)

**When to Use**:
- **Ethereum-focused**: Building primarily on mainnet
- **Existing users**: Have users with EOAs you don't want to migrate
- **Gas-sensitive**: Want lower per-transaction costs
- **Progressive adoption**: Let users add features gradually

**ERC-4337 vs EIP-7702 Comparison**:

| Feature | ERC-4337 | EIP-7702 |
|---------|----------|----------|
| **Status** | Production (2023) | New (May 2025) |
| **Deployment** | Smart contract | Native EOA |
| **Gas Cost** | +20K per tx | Lower (native) |
| **Backwards Compat** | No (new account) | Yes (same EOA) |
| **Multi-chain** | All chains | Ethereum first |
| **Maturity** | 25M accounts | New launch |
| **Features** | Very rich | Growing |

**Recommendation**:
- Use **ERC-4337 now** if you need features immediately
- **Monitor EIP-7702** for Ethereum, consider hybrid approach
- Most providers will support both (complementary, not competing)

---

## ERC-7715: Permission Delegation (Draft Standard)

**Status**: Experimental (draft proposal, May 2024)

**What It Is**:
Standard for how dapps request and manage permissions from wallets.

**Core Concept**:
Instead of signing every transaction, users grant scoped permissions upfront:
```javascript
const permissions = await wallet.request({
  method: 'wallet_grantPermissions',
  params: [{
    eth_accounts: {},
    permitted_calls: [
      { address: '0xDApp', abi: [...] }
    ],
    expiry: timestamp + 3600, // 1 hour
    spending_limits: { token: ETH, amount: '0.1' }
  }]
});
```

**Key Features**:
- **Portable**: Permissions work across different wallet providers
- **Granular**: Specify exactly what dapp can do
- **Time-bound**: Permissions expire automatically
- **Revocable**: Users can revoke at any time

**Relationship to Session Keys**:
ERC-7715 standardizes what many providers call "session keys":
- Privy's native session keys → will become ERC-7715 compliant
- Dynamic's delegated actions → already ERC-7715-like
- ZeroDev permissions → explicitly targets ERC-7715

**Provider Support (2025)**:
- **MetaMask**: Pioneering via Delegation Toolkit
- **WalletConnect**: Co-author of standard
- **Biconomy**: Co-author, implementing
- **ZeroDev**: Co-author, already compatible
- **Privy/Dynamic**: Expected to adopt as standard matures

**When to Use**:
- **Future-proofing**: If building long-term infrastructure
- **MetaMask ecosystem**: If targeting MetaMask users
- **Advanced permissions**: Need fine-grained control
- **Standards compliance**: Want portable permissions

**Current Limitations**:
- ⚠️ Still in draft (not finalized)
- ⚠️ Limited wallet support (MetaMask Flask only)
- ⚠️ API may change before final
- ⚠️ Not production-ready for most apps yet

**Recommendation**:
- **Now**: Use provider native session keys (Privy, Dynamic)
- **6-12 months**: Watch ERC-7715 finalization
- **Long-term**: Migrate to ERC-7715 when widely supported

---

## Provider Roadmaps

### Privy
- **Current**: Native session keys, ERC-4337 support
- **EIP-7702**: On roadmap, monitoring Pectra upgrade
- **ERC-7715**: Will adopt when standard finalizes

### Dynamic
- **Current**: Native session keys, ERC-4337, passkeys
- **EIP-7702**: Active development, early support expected
- **ERC-7715**: Aligned with standard direction

### Web3Auth
- **Current**: ERC-4337 via plugins (ZeroDev, Biconomy)
- **EIP-7702**: Will support via plugins when available
- **ERC-7715**: Plugin approach allows rapid adoption

### Alchemy Account Kit
- **Current**: ERC-4337 native, session key plugin
- **EIP-7702**: Native support planned (already building)
- **ERC-7715**: Evaluating for future adoption

### MetaMask
- **Current**: Delegation Toolkit with ERC-7715 experimental
- **EIP-7702**: Pioneering implementation
- **ERC-7715**: Leading development of standard

### Sequence
- **Current**: ERC-4337 pioneer, native session keys
- **EIP-7702**: Evaluating for gaming use cases
- **ERC-7715**: Interested as standard matures

### LIT Protocol
- **Current**: PKPs with Lit Actions (programmable permissions)
- **EIP-7702**: PKPs can be signers for 7702 delegations
- **ERC-7715**: Conceptually aligned, watching standard

---

## Decision Guide

### "Which standard should I use?"

**For most apps in 2025**: **Start with ERC-4337**
- Production-ready, mature ecosystem
- Works on all chains
- Rich feature set
- All major providers support it

**Add EIP-7702 if**:
- Ethereum mainnet focused
- Have existing EOA users
- Gas costs are significant concern
- Want to avoid account migration

**Consider ERC-7715 when**:
- Building for 2026+
- MetaMask ecosystem important
- Need portable permissions
- Can wait for standard maturity

### Hybrid Approach (Recommended)

Many successful apps will use **both** ERC-4337 and EIP-7702:

```
// For new users: Deploy ERC-4337 smart account
if (user.isNew) {
  account = deploySmartAccount();
}

// For existing EOA users: Use EIP-7702 delegation
if (user.hasExistingEOA) {
  account = enhanceEOAWith7702(user.eoaAddress);
}

// Both support session keys (via ERC-7715 when available)
sessionKey = await account.grantPermissions({
  expiry: '24h',
  spendingLimit: '0.1 ETH'
});
```

This gives you:
- ✅ Flexibility for different user types
- ✅ Backwards compatibility
- ✅ Future-proofing
- ✅ Best of both standards

---

## Migration Planning

### From EOAs to Smart Accounts

**Challenge**: Users have existing EOAs with history, assets, identity

**ERC-4337 Approach** (separate account):
1. Deploy new smart account
2. User transfers assets from EOA → smart account
3. Update frontend to use smart account
4. EOA becomes "legacy" account

**EIP-7702 Approach** (same account):
1. User signs one-time delegation
2. EOA now has smart account features
3. Same address, no migration needed
4. Assets stay in place

**Recommended**: Start with EIP-7702 for Ethereum EOAs, use ERC-4337 for new accounts and L2s

---

## Gas Cost Analysis

**Typical Transaction Costs (2025)**:

| Operation | EOA | ERC-4337 | EIP-7702 |
|-----------|-----|----------|----------|
| Simple transfer | 21K gas | ~41K gas | ~25K gas |
| Token swap | 100K gas | ~120K gas | ~105K gas |
| Account deployment | N/A | ~200K gas | N/A |

**Break-even**: If user makes >10 transactions, ERC-4337 deployment cost is amortized

**Cost Optimization**:
- Use EIP-7702 for infrequent users
- Use ERC-4337 for power users (batch transactions save gas)

---

## Further Reading

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [ERC-7715 Specification](https://eips.ethereum.org/EIPS/eip-7715)
- [Ethereum Pectra Upgrade Details](https://blog.ethereum.org/2025/04/01/pectra-upgrade)
- [Account Abstraction Comparison (Alchemy)](https://www.alchemy.com/overviews/eip-3074-vs-eip-7702-vs-erc-4337)

---

**Last Updated**: 2025-10-24
