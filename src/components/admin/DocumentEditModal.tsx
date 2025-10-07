import React, { useState, useEffect } from 'react';
import { FileText, Save, Calendar, MapPin, Tag } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

interface DocumentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onUpdateSuccess: () => void;
}

export function DocumentEditModal({ 
  isOpen, 
  onClose, 
  document, 
  onUpdateSuccess 
}: DocumentEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('case');
  const [citation, setCitation] = useState('');
  const [jurisdiction, setJurisdiction] = useState('nigeria');
  const [year, setYear] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (document && isOpen) {
      setTitle(document.title || '');
      setDescription(document.description || '');
      setType(document.type || 'case');
      setCitation(document.citation || '');
      setJurisdiction(document.jurisdiction || 'nigeria');
      setYear(document.year ? document.year.toString() : '');
      setTags(document.tags ? document.tags.join(', ') : '');
      setIsPublic(document.is_public ?? true);
    }
  }, [document, isOpen]);

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      const updateData = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        citation: citation.trim() || null,
        jurisdiction,
        year: year ? parseInt(year) : null,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        is_public: isPublic,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', document.id);

      if (error) throw error;

      onUpdateSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Failed to update document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (document) {
      setTitle(document.title || '');
      setDescription(document.description || '');
      setType(document.type || 'case');
      setCitation(document.citation || '');
      setJurisdiction(document.jurisdiction || 'nigeria');
      setYear(document.year ? document.year.toString() : '');
      setTags(document.tags ? document.tags.join(', ') : '');
      setIsPublic(document.is_public ?? true);
    }
    onClose();
  };

  if (!document) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit Document"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Document Information */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">Document Information</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Document ID:</span>
              <p className="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">{document.id}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">File Size:</span>
              <p className="text-gray-900 dark:text-gray-100">
                {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(document.created_at)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Last Updated:</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(document.updated_at)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Uploaded By:</span>
              <p className="text-gray-900 dark:text-gray-100">{document.uploader?.name || 'System'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">File URL:</span>
              <p className="text-gray-900 dark:text-gray-100 text-xs truncate">{document.file_url || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">Edit Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter document description (optional)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Document Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="case">Case</option>
                <option value="statute">Statute</option>
                <option value="regulation">Regulation</option>
                <option value="practice_note">Practice Note</option>
                <option value="template">Template</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Jurisdiction
              </label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="nigeria">Nigeria</option>
                <option value="federal">Federal</option>
                <option value="lagos">Lagos State</option>
                <option value="abuja">FCT Abuja</option>
                <option value="kano">Kano State</option>
                <option value="rivers">Rivers State</option>
              </select>
            </div>

            <Input
              label="Citation"
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              placeholder="e.g., [2023] NGSC 45"
            />

            <Input
              label="Year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g., 2023"
              min="1900"
              max={new Date().getFullYear()}
            />

            <div className="col-span-2">
              <Input
                label="Tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Enter tags separated by commas (e.g., contract, commercial, dispute)"
                helperText="Separate multiple tags with commas"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-5 w-5 min-h-[20px] min-w-[20px] text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Make this document publicly accessible
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Public documents can be accessed by all users for research purposes
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end space-y-reverse space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            className="flex items-center justify-center space-x-2 w-full sm:w-auto min-h-[44px]"
          >
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}