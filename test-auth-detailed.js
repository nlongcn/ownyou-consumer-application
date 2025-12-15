/**
 * Detailed Authentication Workflow Test
 * Captures ALL console logs to analyze wallet creation
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAuthDetailed() {
  console.log('Starting detailed authentication workflow test...\n');

  const startTime = Date.now();
  const screenshotsDir = path.join(__dirname, 'test-screenshots');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Collect ALL console logs
  const allConsoleLogs = [];

  page.on('console', msg => {
    const text = msg.text();
    const timestamp = Date.now() - startTime;
    const logEntry = {
      timestamp,
      type: msg.type(),
      text
    };

    allConsoleLogs.push(logEntry);

    // Print all logs in real-time with timestamp
    console.log(`[${timestamp}ms] [${msg.type()}] ${text}`);
  });

  try {
    console.log('Navigating to http://localhost:3002...\n');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('\nClicking "Get Started" button...\n');
    const getStartedButton = await page.locator('text="Get Started"').first();
    await getStartedButton.click();

    console.log('\nWaiting 10 seconds to capture all logs...\n');
    await page.waitForTimeout(10000);

    // Save all console logs
    const logsFile = path.join(screenshotsDir, 'all-console-logs.json');
    fs.writeFileSync(logsFile, JSON.stringify(allConsoleLogs, null, 2));

    console.log(`\n\nTotal console logs captured: ${allConsoleLogs.length}`);
    console.log(`Logs saved to: ${logsFile}\n`);

    // Filter and display AuthContext logs
    const authLogs = allConsoleLogs.filter(log =>
      log.text.includes('[AuthContext]') ||
      log.text.includes('wallet') ||
      log.text.includes('Wallet')
    );

    console.log('\n=== AUTHENTICATION-RELATED LOGS ===');
    authLogs.forEach(log => {
      console.log(`[${log.timestamp}ms] [${log.type}] ${log.text}`);
    });

    // Filter and display errors
    const errors = allConsoleLogs.filter(log => log.type === 'error');

    console.log('\n=== ERRORS ===');
    if (errors.length === 0) {
      console.log('No errors detected');
    } else {
      errors.forEach(log => {
        console.log(`[${log.timestamp}ms] ${log.text}`);
      });
    }

  } catch (error) {
    console.error('\nTest failed:', error.message);
  } finally {
    console.log('\n\nKeeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('Test complete.\n');
  }
}

testAuthDetailed().catch(console.error);
