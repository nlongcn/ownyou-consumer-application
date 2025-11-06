#!/usr/bin/env python3
"""
TCO (Total Cost of Ownership) Calculator for Auth Providers

Usage:
    python calculate_tco.py --providers="privy,dynamic,web3auth" --users="10000" --output="COST-ANALYSIS.md"
"""

import argparse
from pathlib import Path
from datetime import datetime

PRICING_DATA = {
    "privy": {
        "free_tier": 500,
        "tiers": [
            (500, 0),
            (2500, 299),
            (10000, 1200),
            (100000, 10000),
        ],
        "per_user_above": 0.10,
        "notes": "100K free transactions/month included"
    },
    "web3auth": {
        "free_tier": 1000,
        "per_maw": 0.05,
        "notes": "Simple per-MAW pricing after free tier"
    },
    "dynamic": {
        "free_tier": 1000,
        "tiers": [
            (1000, 0),
            (10000, 600),
            (100000, 5000),
        ],
        "notes": "Operations-based pricing"
    },
    "lit": {
        "free_tier": float('inf'),
        "cost": "Network gas fees only (~$0.001/op)",
        "notes": "Free protocol, pay only network fees"
    },
    "turnkey": {
        "free_tier": 25,  # signatures
        "pro_tier": 99,
        "per_sig": 0.10,
        "notes": "$99/mo + $0.10/additional signature"
    },
    "particle": {
        "free_tier": float('inf'),
        "cost": "100% free for developers",
        "notes": "Completely free"
    },
    "openfort": {
        "free_tier": 1000,
        "tiers": [
            (1000, 0),
            (10000, 200),
            (100000, 2000),
        ],
        "notes": "Cost-effective open-source option"
    },
}


def calculate_cost(provider, users):
    """Calculate monthly cost for provider at given scale"""
    data = PRICING_DATA.get(provider.lower(), {})

    if provider.lower() in ["lit", "particle"]:
        return 0, data.get("cost", "Free")

    if provider.lower() == "web3auth":
        if users <= data["free_tier"]:
            return 0, "Free tier"
        return (users - data["free_tier"]) * data["per_maw"], f"${data['per_maw']}/MAW after {data['free_tier']} free"

    if provider.lower() == "turnkey":
        if users <= data["free_tier"]:
            return 0, "Free tier (25 signatures)"
        monthly_sigs = users * 10  # Estimate 10 sigs/user/month
        return data["pro_tier"] + (monthly_sigs * data["per_sig"]), f"Pro ${data['pro_tier']}/mo + ${data['per_sig']}/sig"

    # Tiered pricing
    tiers = data.get("tiers", [])
    for threshold, cost in tiers:
        if users <= threshold:
            return cost, f"${cost}/month"

    # Above highest tier
    return tiers[-1][1], f"${tiers[-1][1]}+/month (contact sales)"


def generate_tco_analysis(providers_list, users_scale):
    """Generate TCO comparison document"""

    users = int(users_scale)
    providers = [p.strip() for p in providers_list.split(',')]

    output = f"""# Total Cost of Ownership Analysis

**Analysis Date**: {datetime.now().strftime('%Y-%m-%d')}
**User Scale**: {users:,} Monthly Active Users/Wallets
**Providers Compared**: {', '.join([p.title() for p in providers])}

---

## Executive Summary

This analysis compares the total cost of ownership for different authentication providers at your expected scale of **{users:,} users**.

### Cost Comparison Table

| Provider | Current Scale | 10x Scale | 100x Scale | Notes |
|----------|---------------|-----------|------------|-------|
"""

    for provider in providers:
        cost_current, note_current = calculate_cost(provider, users)
        cost_10x, note_10x = calculate_cost(provider, users * 10)
        cost_100x, note_100x = calculate_cost(provider, users * 100)

        provider_data = PRICING_DATA.get(provider.lower(), {})
        notes = provider_data.get("notes", "")

        output += f"| **{provider.title()}** | ${cost_current:,.0f}/mo | ${cost_10x:,.0f}/mo | ${cost_100x:,.0f}/mo | {notes} |\n"

    output += f"""

---

## Detailed Cost Breakdown

"""

    for provider in providers:
        cost, note = calculate_cost(provider, users)
        provider_data = PRICING_DATA.get(provider.lower(), {})

        output += f"""
### {provider.title()}

**Current Cost** ({users:,} users): **${cost:,.2f}/month**

**Pricing Model**: {note}

**At Different Scales**:
- 1K users: ${calculate_cost(provider, 1000)[0]:,.0f}/mo
- 10K users: ${calculate_cost(provider, 10000)[0]:,.0f}/mo
- 100K users: ${calculate_cost(provider, 100000)[0]:,.0f}/mo
- 1M users: ${calculate_cost(provider, 1000000)[0]:,.0f}/mo

**Notes**: {provider_data.get('notes', 'N/A')}

---
"""

    output += f"""
## Cost Efficiency Analysis

### Break-Even Points

"""

    # Calculate break-evens
    for i in range(len(providers)):
        for j in range(i + 1, len(providers)):
            p1, p2 = providers[i], providers[j]
            output += f"**{p1.title()} vs {p2.title()}**: "

            # Find crossover point
            for scale in [1000, 5000, 10000, 50000, 100000, 500000, 1000000]:
                cost1 = calculate_cost(p1, scale)[0]
                cost2 = calculate_cost(p2, scale)[0]

                if cost1 == 0 and cost2 == 0:
                    output += f"Both free at all scales\n"
                    break
                elif cost1 < cost2:
                    output += f"{p1.title()} cheaper at {scale:,} users (${cost1:,.0f} vs ${cost2:,.0f})\n"
                    break
                elif cost2 < cost1:
                    output += f"{p2.title()} cheaper at {scale:,} users (${cost2:,.0f} vs ${cost1:,.0f})\n"
                    break
            else:
                output += f"Costs similar across scales\n"

            output += "\n"

    output += f"""
### Recommendations

**For your scale ({users:,} users)**:
"""

    # Find cheapest option
    costs = [(p, calculate_cost(p, users)[0]) for p in providers]
    costs.sort(key=lambda x: x[1])

    output += f"""
1. **Most Cost-Effective**: {costs[0][0].title()} at ${costs[0][1]:,.2f}/month
2. **Runner-up**: {costs[1][0].title()} at ${costs[1][1]:,.2f}/month
3. **Highest Cost**: {costs[-1][0].title()} at ${costs[-1][1]:,.2f}/month

**Cost Difference**: ${costs[-1][1] - costs[0][1]:,.2f}/month between highest and lowest

---

## Long-Term Cost Projection (3 Years)

Assuming 20% monthly user growth:

"""

    # 3-year projection
    for provider in providers:
        total_cost = 0
        current_users = users

        for month in range(36):
            monthly_cost = calculate_cost(provider, int(current_users))[0]
            total_cost += monthly_cost
            current_users *= 1.05  # 5% monthly growth

        output += f"- **{provider.title()}**: ${total_cost:,.0f} over 3 years\n"

    output += f"""

---

## Hidden Costs to Consider

### Development Time
- **Fast Integration** (Privy, Dynamic): Save 2-4 weeks vs custom
- **Complex Integration** (Turnkey): Requires 4-6 weeks (but full control)
- **Moderate** (Web3Auth, others): 2-3 weeks

**Cost of Development Time**: $10K-$40K (assuming $50/hour engineers)

### Maintenance
- **Managed Services** (Privy, Dynamic, Magic): Minimal maintenance
- **Self-Hosted Options** (Web3Auth CoreKit, Openfort): Ongoing DevOps costs
- **Decentralized** (LIT Protocol): Network monitoring, node health

**Ongoing Maintenance**: $500-$2K/month depending on approach

### Support & SLAs
- **Enterprise Plans**: Often include dedicated support ($1K-$5K/month premium)
- **Community Support**: Free but slower response times
- **Self-Service**: Documentation only

### Migration Costs
- **Vendor Lock-in Risk**: $20K-$100K to migrate providers if needed
- **Key Export Capability**: Reduces lock-in risk significantly

---

## TCO Recommendation

Based on total cost of ownership analysis:

**Primary Recommendation**: {costs[0][0].title()}
- Lowest operational cost
- {PRICING_DATA.get(costs[0][0].lower(), {}).get('notes', '')}

**If Budget is Not Primary Concern**: Consider feature set, developer experience, and long-term roadmap alignment over pure cost savings.

**Cost-Conscious Strategy**:
1. Start with {costs[0][0].title()} (lowest cost)
2. Monitor usage and costs monthly
3. Re-evaluate at 10x scale ({users * 10:,} users)
4. Be prepared to switch if costs become prohibitive

---

## Conclusion

At your scale of **{users:,} users**, the cost difference between providers ranges from **${costs[0][1]:,.0f}** to **${costs[-1][1]:,.0f}** per month.

Over 3 years with growth, this difference compounds to **${calculate_cost(costs[-1][0], users)[0] * 36:,.0f}** vs **${calculate_cost(costs[0][0], users)[0] * 36:,.0f}**.

**However**, cost should not be the only factor. Consider:
- Developer experience and time-to-market
- Feature requirements (session keys, multi-chain, etc.)
- Security and compliance needs
- Long-term roadmap alignment

**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    return output


def main():
    parser = argparse.ArgumentParser(description='Calculate TCO for auth providers')
    parser.add_argument('--providers', required=True, help='Comma-separated provider list')
    parser.add_argument('--users', required=True, help='Expected number of users')
    parser.add_argument('--output', required=True, help='Output filename')

    args = parser.parse_args()

    # Generate TCO analysis
    tco_content = generate_tco_analysis(
        providers_list=args.providers,
        users_scale=args.users
    )

    # Write to file
    output_path = Path(args.output)
    output_path.write_text(tco_content)

    print(f"✅ TCO analysis generated: {output_path}")
    print(f"💰 Review cost projections and recommendations")


if __name__ == '__main__':
    main()
