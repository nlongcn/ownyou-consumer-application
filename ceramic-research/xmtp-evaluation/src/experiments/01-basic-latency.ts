/**
 * Experiment 1: XMTP Basic Message Send/Receive Latency
 *
 * Tests fundamental performance of XMTP for mission card sync:
 * - Send message latency (desktop → self)
 * - Receive message latency (self → self)
 * - Total round-trip time
 *
 * Compare to previous results:
 * - Ceramic Write P95: 13.1ms (local network)
 * - Gun.js Write P95: 571ms (local network)
 * - XMTP Target: <1000ms (P95, with network)
 *
 * Source: context7 - /websites/xmtp
 */

import { createWalletSigner, createXMTPClient, getOrCreateConversation } from '../client/xmtp-client.js';
import { calculateMetrics, formatMetrics } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';
import type { MissionCard } from '../types/mission-card.js';
import type { ExperimentResult } from '../types/metrics.js';

/**
 * Run basic send/receive latency experiment with XMTP
 *
 * Source: context7 - XMTP Node SDK Quickstart
 */
async function runExperiment(): Promise<ExperimentResult> {
  logger.section("Experiment 1: XMTP Basic Message Send/Receive Latency");

  try {
    // 1. Setup two XMTP clients (simulating desktop and mobile)
    logger.info("Setting up XMTP clients (Alice and Bob)...");

    // Alice (desktop)
    const aliceSigner = createWalletSigner();
    const aliceClient = await createXMTPClient(aliceSigner, {
      env: 'dev',
      appVersion: 'ownyou-eval-alice/1.0',
    });
    logger.success(`Alice connected: ${aliceClient.accountAddress}`);

    // Bob (mobile - actually same user, different device)
    const bobSigner = createWalletSigner();
    const bobClient = await createXMTPClient(bobSigner, {
      env: 'dev',
      appVersion: 'ownyou-eval-bob/1.0',
    });
    logger.success(`Bob connected: ${bobClient.accountAddress}`);

    // 2. Create conversation between Alice and Bob
    logger.info("Creating conversation...");

    // Get Bob's inbox ID
    const bobInboxId = bobClient.inboxId;
    logger.info(`Bob's inbox ID: ${bobInboxId}`);

    // Alice creates conversation with Bob
    // Source: context7 - client.conversations.findOrCreateDm(recipientInboxId)
    const aliceConvo = await getOrCreateConversation(aliceClient, bobInboxId);
    logger.success(`Conversation created`);

    // Bob needs to sync to see the conversation
    // Source: context7 - client.conversations.syncAll(['allowed'])
    await bobClient.conversations.syncAll();

    // Get Bob's side of the conversation
    const conversations = await bobClient.conversations.list();
    if (conversations.length === 0) {
      throw new Error("Bob didn't receive conversation");
    }
    const bobConvo = conversations[0];
    logger.success("Bob synced conversation");

    // 3. Run latency measurements
    logger.info("\n📊 Running 100 iterations of send/receive cycles...\n");

    const sendSamples: number[] = [];
    const receiveSamples: number[] = [];
    const totalSamples: number[] = [];

    for (let i = 0; i < 100; i++) {
      // Create mission card content
      const missionCard: MissionCard = {
        missionId: `mission-${i}-${Date.now()}`,
        title: `Test Mission ${i}`,
        status: "ACTIVE",
        createdAt: Date.now(),
        steps: [
          { id: 1, title: "Step 1", completed: false },
          { id: 2, title: "Step 2", completed: false },
        ],
      };

      // Serialize to JSON for XMTP message
      const messageContent = JSON.stringify(missionCard);

      // Measure send latency
      // Source: context7 - await dm.send('Hello world')
      const sendStart = Date.now();
      await aliceConvo.send(messageContent);
      const sendLatency = Date.now() - sendStart;
      sendSamples.push(sendLatency);

      // Measure receive latency (Bob syncs and reads message)
      // Source: context7 - await client.conversations.syncAll(['allowed'])
      const receiveStart = Date.now();

      // Bob syncs to get new messages
      await bobClient.conversations.syncAll();

      // Get messages from conversation
      const messages = await bobConvo.messages();

      // Find our message (last one)
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        throw new Error(`Message ${i} not received`);
      }

      // Verify content
      const receivedCard = JSON.parse(lastMessage.content as string);
      if (receivedCard.missionId !== missionCard.missionId) {
        throw new Error(`Message mismatch at iteration ${i}`);
      }

      const receiveLatency = Date.now() - receiveStart;
      receiveSamples.push(receiveLatency);

      const totalLatency = sendLatency + receiveLatency;
      totalSamples.push(totalLatency);

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        logger.info(`Completed ${i + 1}/100 iterations...`);
      }
    }

    // 4. Calculate and display metrics
    logger.section("Results");

    const sendMetrics = calculateMetrics(sendSamples);
    const receiveMetrics = calculateMetrics(receiveSamples);
    const totalMetrics = calculateMetrics(totalSamples);

    logger.info("Send Latency (XMTP message send):");
    logger.info(`  ${formatMetrics(sendMetrics)}`);

    logger.info("\nReceive Latency (XMTP sync + read):");
    logger.info(`  ${formatMetrics(receiveMetrics)}`);

    logger.info("\nTotal Round-Trip Latency:");
    logger.info(`  ${formatMetrics(totalMetrics)}`);

    // 5. Check success criteria
    logger.section("Success Criteria Evaluation");

    const sendP95Pass = sendMetrics.p95 < 1000;
    const receiveP95Pass = receiveMetrics.p95 < 1000;
    const totalP95Pass = totalMetrics.p95 < 2000;

    logger.info(`Send P95 < 1000ms: ${sendP95Pass ? "✅ PASS" : "❌ FAIL"} (${sendMetrics.p95.toFixed(1)}ms)`);
    logger.info(`Receive P95 < 1000ms: ${receiveP95Pass ? "✅ PASS" : "❌ FAIL"} (${receiveMetrics.p95.toFixed(1)}ms)`);
    logger.info(`Total P95 < 2000ms: ${totalP95Pass ? "✅ PASS" : "❌ FAIL"} (${totalMetrics.p95.toFixed(1)}ms)`);

    // 6. Compare to Ceramic and Gun.js
    logger.section("Comparison to Ceramic and Gun.js");
    logger.info("Ceramic Write P95: 13.1ms (local network)");
    logger.info("Gun.js Write P95: 571.0ms (local network)");
    logger.info(`XMTP Send P95: ${sendMetrics.p95.toFixed(1)}ms (dev network)`);

    const ceramicRatio = sendMetrics.p95 / 13.1;
    const gunRatio = sendMetrics.p95 / 571.0;

    logger.info(`\nXMTP is ${ceramicRatio.toFixed(1)}x ${ceramicRatio > 1 ? 'slower' : 'faster'} than Ceramic`);
    logger.info(`XMTP is ${gunRatio.toFixed(1)}x ${gunRatio > 1 ? 'slower' : 'faster'} than Gun.js`);

    const allPass = sendP95Pass && receiveP95Pass && totalP95Pass;

    return {
      experimentName: "01-xmtp-basic-latency",
      timestamp: Date.now(),
      metrics: totalMetrics,
      rawSamples: totalSamples,
      success: allPass,
    };
  } catch (error) {
    logger.error("Experiment failed:", error);
    return {
      experimentName: "01-xmtp-basic-latency",
      timestamp: Date.now(),
      metrics: calculateMetrics([]),
      rawSamples: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Run experiment
runExperiment()
  .then((result) => {
    logger.section("Experiment 1 Complete");
    logger.info(`Success: ${result.success}`);
    if (result.error) {
      logger.error(`Error: ${result.error}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
  });
