import { useState } from 'react';
import { Header, TokenBalance } from '@ownyou/ui-components';
import { Card } from '@ownyou/ui-design-system';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  id: string;
  type: 'earn' | 'withdraw';
  amount: number;
  description: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

export function Wallet() {
  const { isAuthenticated, wallet } = useAuth();
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Mock transaction data - replace with real data from store
  const transactions: Transaction[] = [
    {
      id: '1',
      type: 'earn',
      amount: 0.05,
      description: 'Data contribution reward',
      timestamp: new Date(Date.now() - 86400000),
      status: 'completed',
    },
    {
      id: '2',
      type: 'earn',
      amount: 0.02,
      description: 'Profile completion bonus',
      timestamp: new Date(Date.now() - 172800000),
      status: 'completed',
    },
  ];

  const totalEarnings = transactions
    .filter(t => t.type === 'earn' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showLogo={false} title="Wallet" />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-8 text-center max-w-sm">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Connect your wallet to start earning OWN tokens for your data contributions.
            </p>
            <button className="w-full bg-[#70DF82] text-white py-3 rounded-full font-bold">
              Connect Wallet
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Wallet" />

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Balance Card */}
        <Card className="p-6 text-center bg-gradient-to-br from-[#70DF82] to-[#50CF62]">
          <p className="text-white text-sm opacity-80 mb-1">Total Balance</p>
          <TokenBalance
            amount={totalEarnings}
            size="large"
            className="text-white justify-center"
          />
          <p className="text-white text-sm opacity-80 mt-2">
            {wallet?.address.slice(0, 6)}...{wallet?.address.slice(-4)}
          </p>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setShowWithdraw(true)}
              className="flex-1 bg-white text-[#70DF82] py-3 rounded-full font-bold"
            >
              Withdraw
            </button>
            <button className="flex-1 bg-white/20 text-white py-3 rounded-full font-bold">
              History
            </button>
          </div>
        </Card>

        {/* Earnings Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Earnings Breakdown</h3>
          <div className="space-y-3">
            <EarningsRow
              label="Data Contributions"
              amount={0.05}
              count={25}
            />
            <EarningsRow
              label="Profile Completeness"
              amount={0.02}
              count={1}
            />
            <EarningsRow
              label="Feedback Rewards"
              amount={0.00}
              count={0}
            />
            <EarningsRow
              label="Referral Bonuses"
              amount={0.00}
              count={0}
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

      {/* Withdraw Modal */}
      {showWithdraw && (
        <WithdrawModal
          balance={totalEarnings}
          onClose={() => setShowWithdraw(false)}
        />
      )}
    </div>
  );
}

interface EarningsRowProps {
  label: string;
  amount: number;
  count: number;
}

function EarningsRow({ label, amount, count }: EarningsRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-600">{count} contributions</p>
      </div>
      <p className="font-bold">{amount.toFixed(2)} OWN</p>
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

interface WithdrawModalProps {
  balance: number;
  onClose: () => void;
}

function WithdrawModal({ balance, onClose }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'amount' | 'confirm' | 'success'>('amount');

  const handleWithdraw = () => {
    // Mock withdrawal - would connect to real blockchain
    setStep('success');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-sm p-6">
        {step === 'amount' && (
          <>
            <h3 className="text-xl font-bold mb-4 text-center">Withdraw OWN</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Available Balance</p>
              <p className="text-2xl font-bold">{balance.toFixed(2)} OWN</p>
            </div>

            <div className="mb-6">
              <label className="text-sm text-gray-600 block mb-1">Amount to Withdraw</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-3 border rounded-lg text-xl font-bold"
                max={balance}
                min={0}
                step={0.01}
              />
              <button
                onClick={() => setAmount(balance.toString())}
                className="text-sm text-[#70DF82] mt-1"
              >
                Max
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border rounded-full font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                className="flex-1 py-3 bg-[#70DF82] text-white rounded-full font-bold disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h3 className="text-xl font-bold mb-4 text-center">Confirm Withdrawal</h3>

            <div className="bg-gray-50 p-4 rounded-lg mb-6 text-center">
              <p className="text-sm text-gray-600">You are withdrawing</p>
              <p className="text-3xl font-bold">{parseFloat(amount).toFixed(2)} OWN</p>
            </div>

            <p className="text-sm text-gray-600 text-center mb-6">
              This transaction will be processed on the blockchain.
              Gas fees may apply.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('amount')}
                className="flex-1 py-3 border rounded-full font-bold"
              >
                Back
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 py-3 bg-[#70DF82] text-white rounded-full font-bold"
              >
                Confirm
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Withdrawal Submitted</h3>
              <p className="text-gray-600 mb-6">
                Your withdrawal of {parseFloat(amount).toFixed(2)} OWN has been submitted.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-[#70DF82] text-white rounded-full font-bold"
              >
                Done
              </button>
            </div>
          </>
        )}
      </Card>
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
