import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Loader2, Download, Copy, Check, Scale, BookOpen, Gavel } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface CaseBriefGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Document {
  id: string;
  title: string;
  type: string;
  citation: string | null;
}

interface CaseBrief {
  id: string;
  title: string;
  brief_type: string;
  jurisdiction: string;
  court: string;
  case_number: string | null;
  parties_plaintiff: string | null;
  parties_defendant: string | null;
  introduction: string;
  statement_of_facts: string;
  issues_presented: string[];
  legal_arguments: string;
  analysis: string;
  conclusion: string;
  prayer_for_relief: string | null;
  citations_used: string[];
}

const BRIEF_TYPES = [
  { value: 'trial', label: 'Trial Brief', description: 'For trial court proceedings' },
  { value: 'appellate', label: 'Appellate Brief', description: 'For appeals to higher courts' },
  { value: 'memorandum', label: 'Memorandum', description: 'Legal analysis and advice' },
  { value: 'motion', label: 'Motion Brief', description: 'Supporting a specific motion' }
];

const NIGERIAN_COURTS = [
  'Supreme Court of Nigeria',
  'Court of Appeal',
  'Federal High Court',
  'State High Court',
  'Lagos State High Court',
  'Abuja High Court',
  'National Industrial Court',
  'Sharia Court of Appeal',
  'Customary Court of Appeal'
];

export function CaseBriefGeneratorModal({ isOpen, onClose }: CaseBriefGeneratorModalProps) {
  const [inputMode, setInputMode] = useState<'document' | 'text'>('document');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [caseText, setCaseText] = useState('');
  const [briefType, setBriefType] = useState<'trial' | 'appellate' | 'memorandum' | 'motion'>('trial');
  const [jurisdiction, setJurisdiction] = useState('nigeria');
  const [court, setCourt] = useState('Federal High Court');
  const [caseNumber, setCaseNumber] = useState('');
  const [partiesPlaintiff, setPartiesPlaintiff] = useState('');
  const [partiesDefendant, setPartiesDefendant] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState<CaseBrief | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, type, citation')
        .in('type', ['case', 'statute', 'regulation'])
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

    if (!court) {
      showError('Validation Error', 'Please select a court');
      return;
    }

    if (inputMode === 'document' && !selectedDocumentId) {
      showError('Validation Error', 'Please select a document');
      return;
    }

    if (inputMode === 'text' && (!caseText || caseText.trim().length < 100)) {
      showError('Validation Error', 'Please provide at least 100 characters of case information');
      return;
    }

    setIsLoading(true);
    setBrief(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-brief-generator`,
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
            brief_type: briefType,
            jurisdiction: jurisdiction,
            court: court,
            case_number: caseNumber || undefined,
            parties_plaintiff: partiesPlaintiff || undefined,
            parties_defendant: partiesDefendant || undefined,
            additional_instructions: additionalInstructions || undefined
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        if (errorData.error === 'FEATURE_RESTRICTED') {
          showError('Pro Feature', errorData.message);
          return;
        }

        throw new Error(errorData.error || 'Failed to generate brief');
      }

      const data = await response.json();

      if (data.success && data.brief) {
        setBrief(data.brief);
        showSuccess('Brief Generated', 'Legal brief has been generated successfully');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error generating brief:', error);
      showError(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate legal brief. Please try again.'
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

  const exportBrief = () => {
    if (!brief) return;

    const exportText = `${brief.title.toUpperCase()}\n\n` +
      `IN THE ${brief.court.toUpperCase()}\n` +
      `${brief.jurisdiction.toUpperCase()}\n\n` +
      (brief.case_number ? `Case No: ${brief.case_number}\n\n` : '') +
      (brief.parties_plaintiff ? `Plaintiff: ${brief.parties_plaintiff}\n` : '') +
      (brief.parties_defendant ? `Defendant: ${brief.parties_defendant}\n\n` : '') +
      `${brief.brief_type.toUpperCase()} BRIEF\n\n` +
      `INTRODUCTION\n${brief.introduction}\n\n` +
      `STATEMENT OF FACTS\n${brief.statement_of_facts}\n\n` +
      `ISSUES PRESENTED\n${brief.issues_presented.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}\n\n` +
      `LEGAL ARGUMENTS\n${brief.legal_arguments}\n\n` +
      `ANALYSIS\n${brief.analysis}\n\n` +
      `CONCLUSION\n${brief.conclusion}\n\n` +
      (brief.prayer_for_relief ? `PRAYER FOR RELIEF\n${brief.prayer_for_relief}\n\n` : '') +
      (brief.citations_used.length > 0 ? `AUTHORITIES CITED\n${brief.citations_used.map((cite, i) => `${i + 1}. ${cite}`).join('\n')}` : '');

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brief.title.replace(/[^a-z0-9]/gi, '_')}_brief.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccess('Exported', 'Brief exported successfully');
  };

  const handleClose = () => {
    setBrief(null);
    setCaseText('');
    setSelectedDocumentId('');
    setCaseNumber('');
    setPartiesPlaintiff('');
    setPartiesDefendant('');
    setAdditionalInstructions('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Case Brief Generator" maxWidth="2xl">
      <div className="space-y-6">
        {!brief ? (
          <>
            <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Gavel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Generate professional legal briefs with comprehensive analysis and proper formatting
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brief Type
                </label>
                <select
                  value={briefType}
                  onChange={(e) => setBriefType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  {BRIEF_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Court
                </label>
                <select
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  {NIGERIAN_COURTS.map((courtName) => (
                    <option key={courtName} value={courtName}>
                      {courtName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Case Number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g., FHC/ABJ/CS/123/2024"
              />
              <Input
                label="Jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="e.g., nigeria"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Plaintiff/Appellant"
                value={partiesPlaintiff}
                onChange={(e) => setPartiesPlaintiff(e.target.value)}
                placeholder="Name of plaintiff/appellant"
              />
              <Input
                label="Defendant/Respondent"
                value={partiesDefendant}
                onChange={(e) => setPartiesDefendant(e.target.value)}
                placeholder="Name of defendant/respondent"
              />
            </div>

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
                  Select Document
                </label>
                <select
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">-- Select a document --</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} {doc.citation ? `(${doc.citation})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Case Information
                </label>
                <textarea
                  value={caseText}
                  onChange={(e) => setCaseText(e.target.value)}
                  placeholder="Paste case facts, legal issues, and relevant information..."
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-800 dark:text-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {caseText.length} characters (minimum 100 required)
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Instructions (Optional)
              </label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="Any specific requirements or focus areas for the brief..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} loading={isLoading}>
                <Gavel className="h-4 w-4 mr-2" />
                Generate Brief
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{brief.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {brief.brief_type.charAt(0).toUpperCase() + brief.brief_type.slice(1)} Brief - {brief.court}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={exportBrief}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBrief(null)}>
                    New Brief
                  </Button>
                </div>
              </div>

              {(brief.case_number || brief.parties_plaintiff || brief.parties_defendant) && (
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  {brief.case_number && <InfoCard label="Case Number" value={brief.case_number} />}
                  {brief.parties_plaintiff && <InfoCard label="Plaintiff" value={brief.parties_plaintiff} />}
                  {brief.parties_defendant && <InfoCard label="Defendant" value={brief.parties_defendant} />}
                </div>
              )}
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <BriefSection
                title="Introduction"
                content={brief.introduction}
                onCopy={() => copySection(brief.introduction, 'introduction')}
                copied={copiedSection === 'introduction'}
              />

              <BriefSection
                title="Statement of Facts"
                content={brief.statement_of_facts}
                onCopy={() => copySection(brief.statement_of_facts, 'facts')}
                copied={copiedSection === 'facts'}
              />

              <BriefSection
                title="Issues Presented"
                content={brief.issues_presented.map((issue, i) => `${i + 1}. ${issue}`).join('\n\n')}
                onCopy={() => copySection(brief.issues_presented.join('\n'), 'issues')}
                copied={copiedSection === 'issues'}
              />

              <BriefSection
                title="Legal Arguments"
                content={brief.legal_arguments}
                highlight
                onCopy={() => copySection(brief.legal_arguments, 'arguments')}
                copied={copiedSection === 'arguments'}
              />

              <BriefSection
                title="Analysis"
                content={brief.analysis}
                highlight
                onCopy={() => copySection(brief.analysis, 'analysis')}
                copied={copiedSection === 'analysis'}
              />

              <BriefSection
                title="Conclusion"
                content={brief.conclusion}
                onCopy={() => copySection(brief.conclusion, 'conclusion')}
                copied={copiedSection === 'conclusion'}
              />

              {brief.prayer_for_relief && (
                <BriefSection
                  title="Prayer for Relief"
                  content={brief.prayer_for_relief}
                  onCopy={() => copySection(brief.prayer_for_relief || '', 'prayer')}
                  copied={copiedSection === 'prayer'}
                />
              )}

              {brief.citations_used.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Authorities Cited</h4>
                  <ol className="space-y-2">
                    {brief.citations_used.map((citation, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                        {i + 1}. {citation}
                      </li>
                    ))}
                  </ol>
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
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function BriefSection({
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
