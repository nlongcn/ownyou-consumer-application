/**
 * Test Data Fixtures for E2E Tests
 *
 * Provides consistent test data for Playwright tests across:
 * - Sprint 3: Mission cards, emails, profiles, evidence
 * - Sprint 4: Memory entries, episodes, procedural rules
 */

import type { MissionCard, Episode } from '@ownyou/shared-types';

// ========================================
// Mission Card Test Data
// ========================================

export const testMissions: Partial<MissionCard>[] = [
  {
    id: 'mission-shopping-1',
    title: 'Great deals on electronics',
    description: 'Found price drops on items matching your recent searches',
    status: 'CREATED',
    priority: 'high',
    triggerAgentId: 'shopping-agent',
    createdAt: new Date().toISOString(),
    actions: [
      {
        type: 'navigate',
        label: 'View Deals',
        payload: { route: '/deals/electronics' },
      },
      {
        type: 'external',
        label: 'Open Amazon',
        payload: { url: 'https://amazon.com' },
      },
    ],
  },
  {
    id: 'mission-content-1',
    title: 'New article recommendations',
    description: 'Articles matching your interest in AI and technology',
    status: 'PRESENTED',
    priority: 'medium',
    triggerAgentId: 'content-agent',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    actions: [
      {
        type: 'navigate',
        label: 'Read Articles',
        payload: { route: '/content/recommendations' },
      },
    ],
  },
  {
    id: 'mission-completed-1',
    title: 'Weekend travel suggestions',
    description: 'Based on your interest in hiking and outdoor activities',
    status: 'COMPLETED',
    priority: 'low',
    triggerAgentId: 'travel-agent',
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    userRating: 4,
    actions: [],
  },
];

// ========================================
// Episode Test Data
// ========================================

export const testEpisodes: Partial<Episode>[] = [
  {
    id: 'episode-1',
    missionId: 'mission-shopping-1',
    agentId: 'shopping-agent',
    trigger: 'Email classification detected purchase intent for electronics',
    action: 'Created shopping mission with deal alerts',
    outcome: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'episode-2',
    missionId: 'mission-completed-1',
    agentId: 'travel-agent',
    trigger: 'Profile indicates interest in outdoor activities',
    action: 'Generated weekend travel suggestions',
    outcome: 'positive',
    userFeedback: 'like',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'episode-3',
    missionId: 'mission-dismissed-1',
    agentId: 'content-agent',
    trigger: 'News article about cryptocurrency',
    action: 'Suggested cryptocurrency investment content',
    outcome: 'negative',
    userFeedback: 'meh',
    createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
  },
];

// ========================================
// Email Test Data
// ========================================

export const testEmails = [
  {
    id: 'email-1',
    subject: 'Your Amazon order has shipped!',
    from: 'ship-confirm@amazon.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    snippet:
      'Your order #123-456-789 is on its way. Expected delivery: Tomorrow by 9 PM.',
    body: 'Track your package at...',
    labels: ['INBOX', 'CATEGORY_UPDATES'],
  },
  {
    id: 'email-2',
    subject: 'Weekly Tech Newsletter',
    from: 'newsletter@techcrunch.com',
    to: 'user@example.com',
    date: new Date(Date.now() - 86400000).toISOString(),
    snippet: 'This week: AI breakthroughs, new smartphone releases...',
    body: 'Full newsletter content...',
    labels: ['INBOX', 'CATEGORY_PROMOTIONS'],
  },
  {
    id: 'email-3',
    subject: 'Flash Sale: 50% off Electronics',
    from: 'deals@bestbuy.com',
    to: 'user@example.com',
    date: new Date(Date.now() - 172800000).toISOString(),
    snippet: 'Limited time: Major discounts on TVs, laptops, and more!',
    body: 'Shop now and save...',
    labels: ['INBOX', 'CATEGORY_PROMOTIONS'],
  },
];

// ========================================
// IAB Profile Test Data
// ========================================

export const testProfile = {
  userId: 'default_user',
  categories: [
    {
      tier1: 'Technology & Computing',
      tier2: 'Consumer Electronics',
      tier3: 'Smartphones',
      confidence: 0.89,
      evidenceCount: 8,
      lastUpdated: new Date().toISOString(),
    },
    {
      tier1: 'Technology & Computing',
      tier2: 'Artificial Intelligence',
      tier3: null,
      confidence: 0.76,
      evidenceCount: 4,
      lastUpdated: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      tier1: 'Shopping',
      tier2: 'Sales & Coupons',
      tier3: null,
      confidence: 0.82,
      evidenceCount: 6,
      lastUpdated: new Date().toISOString(),
    },
    {
      tier1: 'Travel',
      tier2: 'Adventure Travel',
      tier3: 'Hiking & Camping',
      confidence: 0.65,
      evidenceCount: 3,
      lastUpdated: new Date(Date.now() - 259200000).toISOString(),
    },
  ],
  lastUpdated: new Date().toISOString(),
};

// ========================================
// Evidence Test Data
// ========================================

export const testEvidence = [
  {
    id: 'evidence-1',
    classificationId: 'class-1',
    category: 'Technology & Computing > Consumer Electronics > Smartphones',
    reasoning:
      'Email contains shipping confirmation for a smartphone order. Strong purchase signal with brand name "iPhone 15" mentioned.',
    confidence: 0.89,
    sourceType: 'email',
    sourceId: 'email-1',
    keyPhrases: ['iPhone 15', 'order shipped', 'delivery'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'evidence-2',
    classificationId: 'class-2',
    category: 'Technology & Computing > Artificial Intelligence',
    reasoning:
      'Newsletter discusses AI breakthroughs including ChatGPT and Claude. User engagement with tech content indicates interest.',
    confidence: 0.76,
    sourceType: 'email',
    sourceId: 'email-2',
    keyPhrases: ['AI', 'ChatGPT', 'artificial intelligence', 'tech news'],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'evidence-3',
    classificationId: 'class-3',
    category: 'Shopping > Sales & Coupons',
    reasoning:
      'Promotional email with explicit discount language. User frequently receives and engages with deal emails.',
    confidence: 0.82,
    sourceType: 'email',
    sourceId: 'email-3',
    keyPhrases: ['50% off', 'flash sale', 'limited time'],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

// ========================================
// Sprint 4: Memory Test Data
// ========================================

export const testSemanticMemories = [
  {
    id: 'sem-1',
    content:
      'User purchased iPhone 15 Pro Max from Amazon. Shows strong preference for Apple products and premium tier devices.',
    embedding: null, // Will be generated
    sourceType: 'email',
    sourceId: 'email-1',
    categories: ['Technology & Computing', 'Consumer Electronics', 'Smartphones'],
    importance: 0.9,
    accessCount: 5,
    lastAccessed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sem-2',
    content:
      'User reads tech newsletters regularly, particularly interested in AI advancements and new product launches.',
    embedding: null,
    sourceType: 'email',
    sourceId: 'email-2',
    categories: ['Technology & Computing', 'Artificial Intelligence'],
    importance: 0.7,
    accessCount: 3,
    lastAccessed: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const testProceduralRules = [
  {
    id: 'rule-1',
    agentId: 'shopping-agent',
    condition: 'User receives shipping confirmation email',
    action: 'Do not suggest deals on same product category for 7 days',
    confidence: 0.85,
    successCount: 12,
    failureCount: 2,
    createdAt: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
  },
  {
    id: 'rule-2',
    agentId: 'content-agent',
    condition: 'User dismisses cryptocurrency content',
    action: 'Reduce cryptocurrency content suggestions by 80%',
    confidence: 0.92,
    successCount: 8,
    failureCount: 1,
    createdAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
  },
];

export const testEntities = [
  {
    id: 'entity-1',
    type: 'product',
    name: 'iPhone 15 Pro Max',
    attributes: {
      brand: 'Apple',
      category: 'Smartphones',
      price: 1199,
    },
    relations: [
      { type: 'purchased_by', targetId: 'default_user' },
      { type: 'sold_by', targetId: 'entity-2' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'entity-2',
    type: 'company',
    name: 'Amazon',
    attributes: {
      industry: 'E-commerce',
      website: 'amazon.com',
    },
    relations: [{ type: 'sells_to', targetId: 'default_user' }],
    createdAt: new Date().toISOString(),
  },
];

// ========================================
// Utility Functions
// ========================================

/**
 * Generate IndexedDB seeding script for use in page.addInitScript()
 */
export function generateSeedScript(
  storeName: string,
  data: Array<{ id: string; [key: string]: unknown }>
): string {
  const dataJson = JSON.stringify(data);

  return `
    (function() {
      const data = ${dataJson};
      const request = indexedDB.open('ownyou_store', 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('${storeName}')) {
          db.createObjectStore('${storeName}', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const tx = db.transaction(['${storeName}'], 'readwrite');
        const store = tx.objectStore('${storeName}');

        data.forEach((item) => {
          store.put({
            key: 'default_user:${storeName}:' + item.id,
            value: item
          });
        });
      };
    })();
  `;
}
