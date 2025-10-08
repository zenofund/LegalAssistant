import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { BookOpen, Copy, Download } from 'lucide-react';

interface CitationGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCitationGenerated: (citation: string) => void;
}

interface CitationForm {
  caseName: string;
  parties: string;
  year: string;
  court: string;
  reporter: 'NWLR' | 'FWLR';
  volume: string;
  page: string;
  citationStyle: 'full' | 'short';
  judgmentDate: string;
  judges: string;
  caseNumber: string;
}

export function CitationGeneratorModal({ 
  isOpen, 
  onClose, 
  onCitationGenerated 
}: CitationGeneratorModalProps) {
  const [form, setForm] = useState<CitationForm>({
    caseName: '',
    parties: '',
    year: '',
    court: '',
    reporter: 'NWLR',
    volume: '',
    page: '',
    citationStyle: 'full',
    judgmentDate: '',
    judges: '',
    caseNumber: ''
  });
  
  const [generatedCitation, setGeneratedCitation] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleInputChange = (field: keyof CitationForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    // Validate required fields
    if (!form.caseName || !form.year || !form.court || !form.page) {
      showError('Validation Error', 'Please fill in all required fields: Case Name, Year, Court, and Page.');
      return;
    }

    setLoading(true);
    
    try {
      const requestBody = {
        caseName: form.caseName,
        parties: form.parties || undefined,
        year: parseInt(form.year),
        court: form.court,
        reporter: form.reporter,
        volume: form.volume ? parseInt(form.volume) : undefined,
        page: parseInt(form.page),
        citationStyle: form.citationStyle,
        additionalInfo: {
          judgmentDate: form.judgmentDate || undefined,
          judges: form.judges ? form.judges.split(',').map(j => j.trim()) : undefined,
          caseNumber: form.caseNumber || undefined
        }
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-citation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate citation');
      }

      const data = await response.json();
      
      if (data.success) {
        setGeneratedCitation(data.citation);
        showSuccess('Citation Generated', 'Legal citation has been generated successfully.');
      } else {
        throw new Error(data.error || 'Failed to generate citation');
      }

    } catch (error) {
      console.error('Error generating citation:', error);
      showError('Generation Failed', 'Failed to generate citation. Please check your input and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCitation);
      showSuccess('Copied', 'Citation copied to clipboard.');
    } catch (error) {
      showError('Copy Failed', 'Failed to copy citation to clipboard.');
    }
  };

  const handleUseInChat = () => {
    onCitationGenerated(generatedCitation);
    onClose();
  };

  const handleReset = () => {
    setForm({
      caseName: '',
      parties: '',
      year: '',
      court: '',
      reporter: 'NWLR',
      volume: '',
      page: '',
      citationStyle: 'full',
      judgmentDate: '',
      judges: '',
      caseNumber: ''
    });
    setGeneratedCitation('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Legal Citation Generator"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Generate Nigerian Legal Citations</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">Create properly formatted NWLR and FWLR citations</p>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Required Fields */}
          <div className="md:col-span-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Required Information</h4>
          </div>
          
          <Input
            label="Case Name *"
            value={form.caseName}
            onChange={(e) => handleInputChange('caseName', e.target.value)}
            placeholder="e.g., Carlill v. Carbolic Smoke Ball Co."
          />
          
          <Input
            label="Parties (Optional)"
            value={form.parties}
            onChange={(e) => handleInputChange('parties', e.target.value)}
            placeholder="e.g., Carlill (Plaintiff) v. Carbolic Smoke Ball Co. (Defendant)"
            helperText="Leave blank to use case name"
          />
          
          <Input
            label="Year *"
            type="number"
            value={form.year}
            onChange={(e) => handleInputChange('year', e.target.value)}
            placeholder="e.g., 2023"
            min="1900"
            max={new Date().getFullYear()}
          />
          
          <Input
            label="Court *"
            value={form.court}
            onChange={(e) => handleInputChange('court', e.target.value)}
            placeholder="e.g., Supreme Court, Court of Appeal, Federal High Court"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reporter *
            </label>
            <select
              value={form.reporter}
              onChange={(e) => handleInputChange('reporter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="NWLR">NWLR (Nigerian Weekly Law Reports)</option>
              <option value="FWLR">FWLR (Federal Weekly Law Reports)</option>
            </select>
          </div>
          
          <Input
            label="Page Number *"
            type="number"
            value={form.page}
            onChange={(e) => handleInputChange('page', e.target.value)}
            placeholder="e.g., 256"
            min="1"
          />
          
          {/* Optional Fields */}
          <div className="md:col-span-2 mt-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Optional Information</h4>
          </div>
          
          <Input
            label="Volume"
            type="number"
            value={form.volume}
            onChange={(e) => handleInputChange('volume', e.target.value)}
            placeholder="e.g., 1"
            min="1"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Citation Style
            </label>
            <select
              value={form.citationStyle}
              onChange={(e) => handleInputChange('citationStyle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="full">Full Citation (with additional details)</option>
              <option value="short">Short Citation (basic format)</option>
            </select>
          </div>
          
          <Input
            label="Judgment Date"
            type="date"
            value={form.judgmentDate}
            onChange={(e) => handleInputChange('judgmentDate', e.target.value)}
          />
          
          <Input
            label="Judges"
            value={form.judges}
            onChange={(e) => handleInputChange('judges', e.target.value)}
            placeholder="e.g., Onnoghen CJN, Kekere-Ekun JSC"
            helperText="Separate multiple judges with commas"
          />
          
          <Input
            label="Case Number"
            value={form.caseNumber}
            onChange={(e) => handleInputChange('caseNumber', e.target.value)}
            placeholder="e.g., SC.123/2023"
          />
        </div>

        {/* Generated Citation */}
        {generatedCitation && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Generated Citation:</h4>
            <div className="p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-100">
              {generatedCitation}
            </div>
            <div className="flex items-center space-x-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex items-center space-x-1"
              >
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </Button>
              <Button
                size="sm"
                onClick={handleUseInChat}
                className="flex items-center space-x-1"
              >
                <BookOpen className="h-4 w-4" />
                <span>Use in Chat</span>
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
          >
            Reset Form
          </Button>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              loading={loading}
            >
              Generate Citation
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}