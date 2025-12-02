import { useEffect, useState } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';

function App() {
  const [deepLinkUrls, setDeepLinkUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Initializing...');

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
  }, []);

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
        <h2>Connected Packages</h2>
        <ul>
          <li>@ownyou/memory-store</li>
          <li>@ownyou/shared-types</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
