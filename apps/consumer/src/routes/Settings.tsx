import { useState } from 'react';
import { Header } from '@ownyou/ui-components';
import { Card } from '@ownyou/ui-design-system';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

type SettingsSection = 'privacy' | 'data' | 'wallet' | 'sync' | 'about';

export function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('privacy');
  const { isAuthenticated, wallet } = useAuth();
  const { syncStatus, lastSynced } = useSync();

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Settings" />

      <div className="flex-1 px-4 py-6">
        {/* Settings Navigation */}
        <nav className="flex overflow-x-auto gap-2 mb-6 hide-scrollbar">
          {(['privacy', 'data', 'wallet', 'sync', 'about'] as SettingsSection[]).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                activeSection === section
                  ? 'bg-[#70DF82] text-white'
                  : 'bg-white text-black'
              }`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="space-y-4">
          {activeSection === 'privacy' && <PrivacySettings />}
          {activeSection === 'data' && <DataSettings />}
          {activeSection === 'wallet' && <WalletSettings wallet={wallet} isAuthenticated={isAuthenticated} />}
          {activeSection === 'sync' && <SyncSettings syncStatus={syncStatus} lastSynced={lastSynced} />}
          {activeSection === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}

function PrivacySettings() {
  const [localProcessing, setLocalProcessing] = useState(true);
  const [shareAnonymized, setShareAnonymized] = useState(false);

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Privacy Controls</h3>

      <SettingToggle
        label="Local Processing Only"
        description="All data stays on your device"
        checked={localProcessing}
        onChange={setLocalProcessing}
      />

      <SettingToggle
        label="Share Anonymized Insights"
        description="Help improve OwnYou with anonymous data"
        checked={shareAnonymized}
        onChange={setShareAnonymized}
      />

      <div className="pt-4 border-t">
        <h4 className="font-bold mb-2">Data Retention</h4>
        <p className="text-sm text-gray-600 mb-4">
          Choose how long to keep your data on this device
        </p>
        <select className="w-full p-2 rounded-lg border">
          <option value="forever">Keep forever</option>
          <option value="1year">1 year</option>
          <option value="6months">6 months</option>
          <option value="3months">3 months</option>
        </select>
      </div>
    </Card>
  );
}

function DataSettings() {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Data Sources</h3>

      <DataSourceCard
        name="Email"
        provider="Microsoft/Google"
        connected={true}
        lastSync="2 hours ago"
      />

      <DataSourceCard
        name="Calendar"
        provider="Google Calendar"
        connected={false}
      />

      <DataSourceCard
        name="Browser History"
        provider="Chrome Extension"
        connected={false}
      />

      <div className="pt-4 border-t">
        <button className="w-full py-3 text-center text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          Export All Data
        </button>
        <button className="w-full py-3 text-center text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          Delete All Data
        </button>
      </div>
    </Card>
  );
}

interface WalletSettingsProps {
  wallet?: { address: string } | null;
  isAuthenticated: boolean;
}

function WalletSettings({ wallet, isAuthenticated }: WalletSettingsProps) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Wallet</h3>

      {isAuthenticated && wallet ? (
        <>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Wallet Address</p>
            <p className="font-mono text-sm break-all">{wallet.address}</p>
          </div>

          <div className="text-center py-4">
            <p className="text-3xl font-bold">0.00 OWN</p>
            <p className="text-sm text-gray-600">Lifetime Earnings</p>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Connect your wallet to earn OWN tokens</p>
          <button className="bg-[#70DF82] text-white px-6 py-3 rounded-full">
            Connect Wallet
          </button>
        </div>
      )}
    </Card>
  );
}

interface SyncSettingsProps {
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSynced: Date | null;
}

function SyncSettings({ syncStatus, lastSynced }: SyncSettingsProps) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Cross-Device Sync</h3>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Sync Status</p>
          <p className="text-sm text-gray-600">
            {syncStatus === 'syncing' ? 'Syncing...' :
             syncStatus === 'error' ? 'Sync Error' :
             lastSynced ? `Last synced ${formatRelativeTime(lastSynced)}` :
             'Never synced'}
          </p>
        </div>
        <div className={`w-3 h-3 rounded-full ${
          syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
          syncStatus === 'error' ? 'bg-red-500' :
          'bg-green-500'
        }`} />
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-gray-600 mb-4">
          Your data is encrypted end-to-end and synced across your devices using OrbitDB.
        </p>
        <button className="w-full py-2 bg-gray-100 rounded-lg">
          View Paired Devices
        </button>
      </div>
    </Card>
  );
}

function AboutSettings() {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">About OwnYou</h3>

      <div className="text-center py-4">
        <p className="text-2xl font-bold mb-1">OwnYou</p>
        <p className="text-sm text-gray-600">Version 0.1.0</p>
      </div>

      <p className="text-sm text-gray-600">
        OwnYou is a privacy-first personal AI that helps you understand yourself
        better and earn from your data on your terms.
      </p>

      <div className="space-y-2 pt-4 border-t">
        <a href="#" className="block py-2 text-blue-500">Privacy Policy</a>
        <a href="#" className="block py-2 text-blue-500">Terms of Service</a>
        <a href="#" className="block py-2 text-blue-500">Open Source Licenses</a>
      </div>
    </Card>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#70DF82]' : 'bg-gray-300'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

interface DataSourceCardProps {
  name: string;
  provider: string;
  connected: boolean;
  lastSync?: string;
}

function DataSourceCard({ name, provider, connected, lastSync }: DataSourceCardProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-gray-600">{provider}</p>
        {connected && lastSync && (
          <p className="text-xs text-gray-400">Synced {lastSync}</p>
        )}
      </div>
      <button
        className={`px-4 py-1 rounded-full text-sm ${
          connected
            ? 'bg-red-100 text-red-600'
            : 'bg-[#70DF82] text-white'
        }`}
      >
        {connected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}
