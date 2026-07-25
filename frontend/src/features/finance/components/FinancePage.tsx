import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, FileText, Plus, Loader } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useFinanceData } from '../hooks/useFinance';
import { JournalEntryModal } from './JournalEntryModal';
import styles from './FinancePage.module.css';

export const FinancePage: React.FC = () => {
  const { data, isLoading, isError } = useFinanceData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Finance & Accounting</h1>
          <p className={styles.subtitle}>Track ledger, invoices, and journal entries.</p>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Left Pane: Ledger */}
        <div className={styles.ledgerPane}>
          <div className={styles.paneHeader}>
            <h2 className={styles.paneTitle}>Recent Transactions</h2>
            <Button variant="ghost" size="sm">View Full Ledger</Button>
          </div>
          
          <div className={styles.transactionList}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader size={32} className={styles.spinner} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-primary)" />
              </div>
            ) : isError ? (
              <div style={{ padding: '20px', color: 'var(--color-danger)', textAlign: 'center' }}>
                Failed to load transactions.
              </div>
            ) : (
              data?.recentTransactions.map(tx => (
                <div key={tx.id} className={styles.transactionCard}>
                  <div className={`${styles.txIcon} ${tx.type === 'credit' ? styles.txCredit : styles.txDebit}`}>
                    {tx.type === 'credit' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div className={styles.txDetails}>
                    <div className={styles.txDesc}>{tx.desc}</div>
                    <div className={styles.txDate}>{tx.date}</div>
                  </div>
                  <div className={`${styles.txAmount} ${tx.type === 'credit' ? styles.txCreditText : ''}`}>
                    {tx.type === 'credit' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Quick Actions */}
        <div className={styles.actionPane}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Current Cash Balance</div>
            <div className={styles.summaryValue}>
              {isLoading ? '...' : `Rp ${data?.currentCashBalance.toLocaleString('id-ID')}`}
            </div>
          </div>
          
          <h3 className={styles.paneTitle} style={{ marginTop: 24, marginBottom: 16 }}>Quick Actions</h3>
          
          <div className={styles.actionGrid}>
            <button className={styles.quickActionBtn}>
              <Plus size={20} className={styles.quickActionIcon} />
              <span>Create Invoice</span>
            </button>
            <button className={styles.quickActionBtn}>
              <FileText size={20} className={styles.quickActionIcon} />
              <span>Record Expense</span>
            </button>
            <button className={styles.quickActionBtn} onClick={() => setIsModalOpen(true)}>
              <ArrowUpRight size={20} className={styles.quickActionIcon} />
              <span>Manual Journal</span>
            </button>
          </div>
        </div>
      </div>

      <JournalEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
