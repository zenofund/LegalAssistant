import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Loader2, Download, Copy, Check, Scale, Gavel, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface CaseSummarizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Document {
  id: string;
  title: string;
  type: string;
  citation: string | null;
}

interface CaseSummary {
  id: string;
  title: string;
  case_name: string;
  case_citation: string;
  facts: string;
  issues: string[];
  holding: string;
  reasoning: string;
  ratio_decidendi: string;
  obiter_dicta: string;
  jurisdiction: string;
  court: string;
  year: number;
  judges: string[];
}

export function CaseSummarizerModal({ isOpen, onClose }: CaseSummarizerModalProps) {
  const [inputMode, setInputMode] = useState<'document' | 'text'>('document');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [caseText, setCaseText] = useState('');
  const [summaryType, setSummaryType] = useState<'standard' | 'detailed' | 'brief'>('standard');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCaseDocuments();
    }
  }, [isOpen]);

  const loadCaseDocuments = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, type, citation')
        .eq('type', 'case')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleGenerate = async () => {
    if (!profile) {
      showError('Profile Error', 'User profile not loaded. Please refresh the page and try again.');
      return;
    }

    if (inputMode === 'document' && !selectedDocumentId) {
      showError('Validation Error', 'Please select a case document');
      return;
    }

    if (inputMode === 'text' && (!caseText || caseText.trim().length < 100)) {
      showError('Validation Error', 'Please provide at least 100 characters of case text');
      return;
    }

    setIsLoading(true);
    setSummary(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-summarizer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: profile.id,
            document_id: inputMode === 'document' ? selectedDocumentId : undefined,
            case_text: inputMode === 'text' ? caseText : undefined,
            summary_type: summaryType
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.error === 'FEATURE_RESTRICTED') {
          showError('Pro Feature', errorData.message);
          return;
        }

        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();

      if (data.success && data.summary) {
        setSummary(data.summary);
        showSuccess('Summary Generated', 'Case summary has been generated successfully');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      showError(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate case summary. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copySection = async (content: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      showError('Copy Failed', 'Failed to copy to clipboard');
    }
  };

  const exportSummary = () => {
    if (!summary) return;

    const exportText = `CASE SUMMARY\n\n` +
      `Case Name: ${summary.case_name}\n` +
      `Citation: ${summary.case_citation || 'N/A'}\n` +
      `Court: ${summary.court || 'N/A'}\n` +
      `Year: ${summary.year || 'N/A'}\n` +
      `Jurisdiction: ${summary.jurisdiction}\n` +
      `Judges: ${summary.judges.join(', ') || 'N/A'}\n\n` +
      `FACTS:\n${summary.facts}\n\n` +
      `ISSUES:\n${summary.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}\n\n` +
      `HOLDING:\n${summary.holding}\n\n` +
      `REASONING:\n${summary.reasoning}\n\n` +
      `RATIO DECIDENDI:\n${summary.ratio_decidendi || 'N/A'}\n\n` +
      `OBITER DICTA:\n${summary.obiter_dicta || 'N/A'}\n`;

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summary.case_name.replace(/[^a-z0-9]/gi, '_')}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccess('Exported', 'Summary exported successfully');
  };

  const handleClose = () => {
    setSummary(null);
    setCaseText('');
    setSelectedDocumentId('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Case Summarizer" size="xl">
      <div className="space-y-6">
        {!summary ? (
          <>
            <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Generate comprehensive case summaries with AI analysis including facts, issues, holdings, and legal principles
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Input Method
                </label>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setInputMode('document')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                      inputMode === 'document'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Select Document</span>
                  </button>
                  <button
                    onClick={() => setInputMode('text')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                      inputMode === 'text'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <BookOpen className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Paste Text</span>
                  </button>
                </div>
              </div>

              {inputMode === 'document' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Case Document
                  </label>
                  <select
                    value={selectedDocumentId}
                    onChange={(e) => setSelectedDocumentId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">-- Select a case --</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title} {doc.citation ? `(${doc.citation})` : ''}
                      </option>
                    ))}
                  </select>
                  {documents.length === 0 && (
                    <p className="mt-2 text-sm text-gray-500">No case documents available. Upload cases first.</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Case Text
                  </label>
                  <textarea
                    value={caseText}
                    onChange={(e) => setCaseText(e.target.value)}
                    placeholder="Paste the full case text here..."
                    rows={10}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {caseText.length} characters (minimum 100 required)
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Summary Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['brief', 'standard', 'detailed'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSummaryType(type)}
                      className={`p-3 rounded-lg border-2 transition-colors capitalize ${
                        summaryType === type
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-medium">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} loading={isLoading}>
                <Gavel className="h-4 w-4 mr-2" />
                Generate Summary
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{summary.case_name}</h3>
                {summary.case_citation && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{summary.case_citation}</p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={exportSummary}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSummary(null)}>
                  New Summary
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard label="Court" value={summary.court || 'N/A'} />
              <InfoCard label="Year" value={summary.year?.toString() || 'N/A'} />
              <InfoCard label="Jurisdiction" value={summary.jurisdiction} />
              <InfoCard label="Judges" value={summary.judges.length > 0 ? summary.judges.length.toString() : 'N/A'} />
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <SummarySection
                title="Facts"
                content={summary.facts}
                onCopy={() => copySection(summary.facts, 'facts')}
                copied={copiedSection === 'facts'}
              />

              <SummarySection
                title="Issues"
                content={summary.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}
                onCopy={() => copySection(summary.issues.join('\n'), 'issues')}
                copied={copiedSection === 'issues'}
              />

              <SummarySection
                title="Holding"
                content={summary.holding}
                onCopy={() => copySection(summary.holding, 'holding')}
                copied={copiedSection === 'holding'}
              />

              <SummarySection
                title="Reasoning"
                content={summary.reasoning}
                onCopy={() => copySection(summary.reasoning, 'reasoning')}
                copied={copiedSection === 'reasoning'}
              />

              {summary.ratio_decidendi && (
                <SummarySection
                  title="Ratio Decidendi"
                  content={summary.ratio_decidendi}
                  highlight
                  onCopy={() => copySection(summary.ratio_decidendi, 'ratio')}
                  copied={copiedSection === 'ratio'}
                />
              )}

              {summary.obiter_dicta && (
                <SummarySection
                  title="Obiter Dicta"
                  content={summary.obiter_dicta}
                  onCopy={() => copySection(summary.obiter_dicta, 'obiter')}
                  copied={copiedSection === 'obiter'}
                />
              )}

              {summary.judges.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Judges</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.judges.map((judge, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-white dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300"
                      >
                        {judge}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{value}</p>
    </div>
  );
}

function SummarySection({
  title,
  content,
  highlight,
  onCopy,
  copied
}: {
  title: string;
  content: string;
  highlight?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg ${
        highlight
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
        <button
          onClick={onCopy}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{content}</p>
    </div>
  );
}
