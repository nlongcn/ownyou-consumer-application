import { useEffect, useState } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { InMemoryBackend } from '@ownyou/memory-store';
import { NAMESPACES } from '@ownyou/shared-types';

// Create backend instance for demo (demonstrates @ownyou/memory-store integration)
const backend = new InMemoryBackend();

// Demo data type
interface DemoData {
  count: number;
  lastWrite: string;
}

interface StoreDemo {
  testValue: string | null;
  writeCount: number;
  lastWrite: string | null;
  error: string | null;
}

function App() {
  const [deepLinkUrls, setDeepLinkUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Initializing...');
  const [storeDemo, setStoreDemo] = useState<StoreDemo>({
    testValue: null,
    writeCount: 0,
    lastWrite: null,
    error: null,
  });

  useEffect(() => {
    // Check if app was launched via deep link
    const checkInitialDeepLink = async () => {
      try {
        const urls = await getCurrent();
        if (urls && urls.length > 0) {
          setDeepLinkUrls(urls);
          setStatus(`Launched via deep link: ${urls.join(', ')}`);
        } else {
          setStatus('Ready - No deep link detected');
        }
      } catch (err) {
        console.error('Failed to get initial deep link:', err);
        setStatus('Ready');
      }
    };

    // Listen for new deep links while app is running
    const setupDeepLinkListener = async () => {
      try {
        await onOpenUrl((urls) => {
          console.log('Deep link received:', urls);
          setDeepLinkUrls(urls);
          setStatus(`Deep link received: ${urls.join(', ')}`);
        });
      } catch (err) {
        console.error('Failed to setup deep link listener:', err);
      }
    };

    checkInitialDeepLink();
    setupDeepLinkListener();

    // Initialize store demo - read existing value
    const initStoreDemo = async () => {
      try {
        const existing = await backend.get<DemoData>(
          NAMESPACES.SEMANTIC_MEMORY,
          'demo-user',
          'demo-counter'
        );
        if (existing) {
          setStoreDemo((prev) => ({
            ...prev,
            testValue: `Count: ${existing.count}`,
            writeCount: existing.count,
            lastWrite: existing.lastWrite,
          }));
        }
      } catch (err) {
        console.error('Failed to read from store:', err);
      }
    };
    initStoreDemo();
  }, []);

  // Demo: Write to store
  const handleStoreWrite = async () => {
    try {
      const newCount = storeDemo.writeCount + 1;
      const now = new Date().toISOString();
      const demoData: DemoData = { count: newCount, lastWrite: now };
      await backend.put(
        NAMESPACES.SEMANTIC_MEMORY,
        'demo-user',
        'demo-counter',
        demoData
      );
      setStoreDemo({
        testValue: `Count: ${newCount}`,
        writeCount: newCount,
        lastWrite: now,
        error: null,
      });
    } catch (err) {
      setStoreDemo((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  };

  // Demo: Read from store
  const handleStoreRead = async () => {
    try {
      const value = await backend.get<DemoData>(
        NAMESPACES.SEMANTIC_MEMORY,
        'demo-user',
        'demo-counter'
      );
      if (value) {
        setStoreDemo({
          testValue: `Count: ${value.count}`,
          writeCount: value.count,
          lastWrite: value.lastWrite,
          error: null,
        });
      } else {
        setStoreDemo((prev) => ({
          ...prev,
          testValue: 'No data found',
          error: null,
        }));
      }
    } catch (err) {
      setStoreDemo((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  };

  return (
    <div className="container">
      <h1>OwnYou Desktop</h1>

      <div className="status-card">
        <h2>Status</h2>
        <p>{status}</p>
      </div>

      {deepLinkUrls.length > 0 && (
        <div className="deep-link-card">
          <h2>Deep Link URLs</h2>
          <ul>
            {deepLinkUrls.map((url, index) => (
              <li key={index}>{url}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="info-card">
        <h2>Test Deep Links</h2>
        <p>Open these URLs in your browser to test:</p>
        <ul>
          <li><code>ownyou://test</code></li>
          <li><code>ownyou://oauth/callback/microsoft</code></li>
          <li><code>ownyou://oauth/callback/google</code></li>
        </ul>
      </div>

      <div className="packages-card">
        <h2>Memory Store Demo</h2>
        <p>Test @ownyou/memory-store read/write operations:</p>
        <div className="store-demo">
          <div className="store-value">
            <strong>Stored Value:</strong> {storeDemo.testValue ?? 'Not yet read'}
          </div>
          {storeDemo.lastWrite && (
            <div className="store-timestamp">
              <strong>Last Write:</strong> {storeDemo.lastWrite}
            </div>
          )}
          {storeDemo.error && (
            <div className="store-error">
              <strong>Error:</strong> {storeDemo.error}
            </div>
          )}
          <div className="store-buttons">
            <button onClick={handleStoreWrite}>Write to Store</button>
            <button onClick={handleStoreRead}>Read from Store</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
