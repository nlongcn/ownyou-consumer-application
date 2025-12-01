/**
 * Experiment 1: Gun.js Basic Write/Read Latency
 *
 * Tests fundamental performance of Gun for mission card sync:
 * - Create (put) latency
 * - Read (get + on) latency
 * - Total round-trip time
 *
 * Compare to Ceramic results:
 * - Ceramic Write P95: 13.1ms (local network)
 * - Gun Target: <100ms (P95)
 *
 * Source: context7 - /amark/gun
 */

import Gun from 'gun';
import { createGunClient, verifyGunConnection } from '../client/gun-client.js';
import { calculateMetrics, formatMetrics } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';
import type { MissionCard } from '../types/mission-card.js';
import type { ExperimentResult } from '../types/metrics.js';

/**
 * Run basic write/read latency experiment with Gun.js
 *
 * Source: context7 - gun.get('mark').put({ name: "Mark" })
 * Source: context7 - gun.get('mark').on((data, key) => { console.log(data) })
 */
async function runExperiment(): Promise<ExperimentResult> {
  logger.section("Experiment 1: Gun.js Basic Write/Read Latency");

  try {
    // 1. Setup Gun client (localStorage only, no relay)
    logger.info("Setting up Gun client (P2P mode, no relay)...");
    const gun = createGunClient({
      peers: [], // Pure P2P, no relay
      localStorage: true,
    });

    const connected = verifyGunConnection(gun);
    if (!connected) {
      throw new Error("Gun connection failed");
    }
    logger.success("Connected to Gun (P2P mode)");

    // 2. Run latency measurements
    logger.info("\n📊 Running 100 iterations of write/read cycles...\n");

    const writeSamples: number[] = [];
    const readSamples: number[] = [];
    const totalSamples: number[] = [];

    for (let i = 0; i < 100; i++) {
      // Create mission card content (Gun-compatible structure)
      // Gun doesn't handle arrays well - use set() for collections
      // Source: context7 - gun.get('users').set(object)
      const missionId = `mission-${i}-${Date.now()}`;
      const missionKey = `missions/${missionId}`;

      const missionData = {
        missionId,
        title: `Test Mission ${i}`,
        status: "ACTIVE",
        createdAt: Date.now(),
      };

      const steps = [
        { id: 1, title: "Step 1", completed: false },
        { id: 2, title: "Step 2", completed: false },
      ];

      // Measure write (put mission + set steps)
      // Source: context7 - gun.get('mark').put({ name: "Mark" })
      const writeStart = Date.now();

      // Write mission data
      await new Promise<void>((resolve) => {
        gun.get(missionKey).put(missionData, (ack: any) => {
          if (ack.err) {
            throw new Error(`Gun put failed: ${ack.err}`);
          }
          resolve();
        });
      });

      // Write steps as set
      // Source: context7 - gun.get('users').set(object)
      const stepsRef = gun.get(missionKey).get('steps');
      for (const step of steps) {
        await new Promise<void>((resolve) => {
          stepsRef.set(step, (ack: any) => {
            if (ack.err) {
              throw new Error(`Gun set failed: ${ack.err}`);
            }
            resolve();
          });
        });
      }

      const writeLatency = Date.now() - writeStart;
      writeSamples.push(writeLatency);

      // Measure read (get + on for mission + map for steps)
      // Source: context7 - gun.get('mark').on((data) => { ... })
      const readStart = Date.now();

      // Read mission data
      await new Promise<void>((resolve) => {
        gun.get(missionKey).once((data: any) => {
          if (!data) {
            throw new Error("Gun read returned null");
          }
          resolve();
        });
      });

      // Read steps (map over set)
      // Source: context7 - gun.get('users').map().once(callback)
      await new Promise<void>((resolve) => {
        let stepCount = 0;
        gun.get(missionKey).get('steps').map().once((step: any) => {
          if (step) {
            stepCount++;
            if (stepCount === 2) { // We added 2 steps
              resolve();
            }
          }
        });
      });

      const readLatency = Date.now() - readStart;
      readSamples.push(readLatency);

      const totalLatency = writeLatency + readLatency;
      totalSamples.push(totalLatency);

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        logger.info(`Completed ${i + 1}/100 iterations...`);
      }
    }

    // 3. Calculate and display metrics
    logger.section("Results");

    const writeMetrics = calculateMetrics(writeSamples);
    const readMetrics = calculateMetrics(readSamples);
    const totalMetrics = calculateMetrics(totalSamples);

    logger.info("Write Latency (gun.put):");
    logger.info(`  ${formatMetrics(writeMetrics)}`);

    logger.info("\nRead Latency (gun.once):");
    logger.info(`  ${formatMetrics(readMetrics)}`);

    logger.info("\nTotal Round-Trip Latency:");
    logger.info(`  ${formatMetrics(totalMetrics)}`);

    // 4. Check success criteria
    logger.section("Success Criteria Evaluation");

    const writeP95Pass = writeMetrics.p95 < 100;
    const readP95Pass = readMetrics.p95 < 100;
    const totalP95Pass = totalMetrics.p95 < 200;

    logger.info(`Write P95 < 100ms: ${writeP95Pass ? "✅ PASS" : "❌ FAIL"} (${writeMetrics.p95.toFixed(1)}ms)`);
    logger.info(`Read P95 < 100ms: ${readP95Pass ? "✅ PASS" : "❌ FAIL"} (${readMetrics.p95.toFixed(1)}ms)`);
    logger.info(`Total P95 < 200ms: ${totalP95Pass ? "✅ PASS" : "❌ FAIL"} (${totalMetrics.p95.toFixed(1)}ms)`);

    // 5. Compare to Ceramic
    logger.section("Comparison to Ceramic");
    logger.info("Ceramic Write P95: 13.1ms (local network)");
    logger.info(`Gun Write P95: ${writeMetrics.p95.toFixed(1)}ms`);
    const writeRatio = writeMetrics.p95 / 13.1;
    logger.info(`Gun is ${writeRatio.toFixed(1)}x ${writeRatio > 1 ? 'slower' : 'faster'} than Ceramic`);

    const allPass = writeP95Pass && readP95Pass && totalP95Pass;

    return {
      experimentName: "01-gun-basic-latency",
      timestamp: Date.now(),
      metrics: totalMetrics,
      rawSamples: totalSamples,
      success: allPass,
    };
  } catch (error) {
    logger.error("Experiment failed:", error);
    return {
      experimentName: "01-gun-basic-latency",
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
