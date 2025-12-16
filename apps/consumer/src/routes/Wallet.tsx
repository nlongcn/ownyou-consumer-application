import { useState, useEffect } from 'react';
import { Header } from '@ownyou/ui-components';
import { Card } from '@ownyou/ui-design-system';
import { useAuth } from '../contexts/AuthContext';
import { useIkigaiRewards } from '../contexts/IkigaiContext';
import { useStore } from '../contexts/StoreContext';
import { NS } from '@ownyou/shared-types';

interface Transaction {
  id: string;
  type: 'earn' | 'withdraw';
  amount: number;
  description: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

export function Wallet() {
  const { isAuthenticated, wallet, connect, isLoading } = useAuth();
  const { points, tier, refresh } = useIkigaiRewards();
  const { store, isReady } = useStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  const userId = wallet?.address ?? 'anonymous';

  // Load transactions from store
  useEffect(() => {
    if (!store || !isReady || !isAuthenticated) {
      setIsLoadingTransactions(false);
      return;
    }

    const loadTransactions = async () => {
      setIsLoadingTransactions(true);
      try {
        // Load transactions from earnings namespace
        const result = await store.list<Transaction>(
          NS.earnings(userId),
          { limit: 20, offset: 0 }
        );
        setTransactions(result.items.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })));
      } catch (error) {
        console.error('[Wallet] Failed to load transactions:', error);
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    loadTransactions();
  }, [store, isReady, isAuthenticated, userId]);

  // Total points from real data
  const totalPoints = points.total;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showLogo={false} title="Wallet" showFilters={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-8 text-center max-w-sm">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Connect your wallet to start earning OWN tokens for your data contributions.
            </p>
            <button
              onClick={connect}
              disabled={isLoading}
              className="w-full bg-ownyou-secondary text-white py-3 rounded-full font-bold disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Wallet" showFilters={false} />

      <div className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
        {/* Balance Card */}
        <Card className="p-6 text-center bg-gradient-to-br from-ownyou-secondary to-green-500">
          <p className="text-white text-sm opacity-80 mb-1">Total Points</p>
          <p className="text-4xl font-bold text-white">
            {totalPoints.toLocaleString()}
          </p>
          <p className="text-white text-sm opacity-80 mt-2">
            {wallet?.address.slice(0, 6)}...{wallet?.address.slice(-4)}
          </p>

          {/* Tier Progress */}
          <div className="mt-4 bg-white/20 rounded-full p-3">
            <div className="flex items-center justify-between text-white text-sm mb-1">
              <span>{tier.tier} Tier</span>
              <span>{Math.round(tier.progress * 100)}% to next</span>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${tier.progress * 100}%` }}
              />
            </div>
            <p className="text-xs text-white/80 mt-1">
              {tier.nextTierAt - totalPoints} pts to next tier
            </p>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={refresh}
              className="flex-1 bg-white text-ownyou-secondary py-3 rounded-full font-bold"
            >
              Refresh
            </button>
            <button className="flex-1 bg-white/20 text-white py-3 rounded-full font-bold">
              History
            </button>
          </div>
        </Card>

        {/* Points Breakdown by Category */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Points Breakdown</h3>
          <div className="space-y-3">
            <PointsRow
              label="Explorer"
              description="Discovering new experiences"
              points={points.explorer}
              icon="🧭"
            />
            <PointsRow
              label="Connector"
              description="Building relationships"
              points={points.connector}
              icon="🤝"
            />
            <PointsRow
              label="Helper"
              description="Contributing to others"
              points={points.helper}
              icon="💝"
            />
            <PointsRow
              label="Achiever"
              description="Completing missions"
              points={points.achiever}
              icon="🏆"
            />
          </div>
        </Card>

        {/* Transaction History */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
          {transactions.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </Card>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingTransactions && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-ownyou-secondary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

interface PointsRowProps {
  label: string;
  description: string;
  points: number;
  icon: string;
}

function PointsRow({ label, description, points, icon }: PointsRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <p className="font-bold text-ownyou-secondary">{points.toLocaleString()} pts</p>
    </div>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const isEarn = transaction.type === 'earn';

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isEarn ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          <span>{isEarn ? '↓' : '↑'}</span>
        </div>
        <div>
          <p className="font-medium">{transaction.description}</p>
          <p className="text-sm text-gray-600">
            {formatDate(transaction.timestamp)}
          </p>
        </div>
      </div>
      <p className={`font-bold ${isEarn ? 'text-green-600' : 'text-gray-600'}`}>
        {isEarn ? '+' : '-'}{transaction.amount.toFixed(2)} OWN
      </p>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
