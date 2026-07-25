import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCreateJournalEntry } from '../hooks/useFinance';
import { JournalEntryLine } from '../types/finance.types';
import styles from './JournalEntryModal.module.css';

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({ isOpen, onClose }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { accountId: '', debit: 0, credit: 0 },
    { accountId: '', debit: 0, credit: 0 },
  ]);

  const { mutate, isPending } = useCreateJournalEntry();

  const handleLineChange = (index: number, field: keyof JournalEntryLine, value: string | number) => {
    const newLines = [...lines];
    if (field === 'debit' || field === 'credit') {
      newLines[index][field] = Number(value) || 0;
    } else {
      newLines[index].accountId = value as string;
    }
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { accountId: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = lines.reduce((sum, line) => sum + line.credit, 0);
    return {
      totalDebit: debit,
      totalCredit: credit,
      isBalanced: debit === credit && debit > 0,
    };
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return;

    mutate({
      date,
      description,
      lines,
    }, {
      onSuccess: () => {
        onClose();
        // Reset form
        setDate(new Date().toISOString().split('T')[0]);
        setDescription('');
        setLines([{ accountId: '', debit: 0, credit: 0 }, { accountId: '', debit: 0, credit: 0 }]);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Manual Journal Entry</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form id="journalForm" className={styles.content} onSubmit={handleSubmit}>
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Date</label>
              <Input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            <div className={styles.formGroup} style={{ flex: 2 }}>
              <label className={styles.label}>Description</label>
              <Input 
                placeholder="Entry description..." 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className={styles.linesContainer}>
            <table className={styles.linesTable}>
              <thead>
                <tr>
                  <th>Account Code / Name</th>
                  <th style={{ width: '150px' }}>Debit</th>
                  <th style={{ width: '150px' }}>Credit</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      <input 
                        className={styles.lineInput} 
                        placeholder="e.g. 1000 - Cash"
                        value={line.accountId}
                        onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className={styles.lineInput} 
                        value={line.debit || ''}
                        onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                        disabled={line.credit > 0}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className={styles.lineInput} 
                        value={line.credit || ''}
                        onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                        disabled={line.debit > 0}
                      />
                    </td>
                    <td>
                      <button 
                        type="button"
                        className={styles.iconBtn} 
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 2}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className={styles.addLineBtn} onClick={addLine}>
              <Plus size={16} /> Add Line
            </button>
          </div>
        </form>

        <div className={styles.footer}>
          <div>
            <div className={styles.totals}>
              <span>Total Debit: <strong>Rp {totalDebit.toLocaleString('id-ID')}</strong></span>
              <span>Total Credit: <strong>Rp {totalCredit.toLocaleString('id-ID')}</strong></span>
            </div>
            {!isBalanced && (totalDebit > 0 || totalCredit > 0) && (
              <div className={styles.totalsError}>Total debit must equal total credit.</div>
            )}
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
            <Button variant="primary" type="submit" form="journalForm" disabled={!isBalanced || isPending}>
              {isPending ? 'Posting...' : 'Post Journal'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
