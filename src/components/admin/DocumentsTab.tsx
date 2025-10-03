import React, { useState, useEffect } from 'react';
import { FileText, Plus, Eye, CreditCard as Edit, Trash2, AlertTriangle, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { DocumentEditModal } from './DocumentEditModal';
import { UploadModal } from '../documents/UploadModal';
import { formatDate } from '../../lib/utils';

export function DocumentsTab() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          uploader:users(name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDocument = (document: any) => {
    setDocumentToEdit(document);
    setShowEditDocumentModal(true);
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentToDelete.id);

      if (error) throw error;

      await loadDocuments();
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDocument = (document: any) => {
    setSelectedDocument(document);
    setShowDocumentModal(true);
  };

  const handleUpdateSuccess = () => {
    loadDocuments();
    setShowEditDocumentModal(false);
    setDocumentToEdit(null);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.citation && doc.citation.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Documents Management</h2>
        <Button onClick={() => setShowUploadModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="case">Cases</option>
            <option value="statute">Statutes</option>
            <option value="regulation">Regulations</option>
            <option value="practice_note">Practice Notes</option>
            <option value="template">Templates</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jurisdiction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <div className="animate-pulse space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-48"></div>
                          <div className="h-3 bg-gray-200 rounded w-32"></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            doc.type === 'case' 
                              ? 'bg-blue-100 text-blue-600'
                              : doc.type === 'statute'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.title}
                            </p>
                            {doc.citation && (
                              <p className="text-sm text-gray-500 truncate">{doc.citation}</p>
                            )}
                            {doc.year && (
                              <p className="text-xs text-gray-400">Year: {doc.year}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          doc.type === 'case' 
                            ? 'bg-blue-100 text-blue-800'
                            : doc.type === 'statute'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.type === 'regulation'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {doc.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                        {doc.jurisdiction}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {doc.uploader?.name || 'System'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDocument(doc)}
                            title="Edit Document"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDocumentToDelete(doc);
                              setShowDeleteConfirm(true);
                            }}
                            title="Delete Document"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Document Details Modal */}
      <Modal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        title="Document Details"
        maxWidth="2xl"
      >
        {selectedDocument && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <p className="text-sm text-gray-900">{selectedDocument.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <p className="text-sm text-gray-900 capitalize">{selectedDocument.type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Citation</label>
                <p className="text-sm text-gray-900">{selectedDocument.citation || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <p className="text-sm text-gray-900">{selectedDocument.year || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
                <p className="text-sm text-gray-900 capitalize">{selectedDocument.jurisdiction}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uploaded By</label>
                <p className="text-sm text-gray-900">{selectedDocument.uploader?.name || 'System'}</p>
              </div>
            </div>
            
            {selectedDocument.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-900">{selectedDocument.description}</p>
                </div>
              </div>
            )}

            {selectedDocument.tags && selectedDocument.tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Size</label>
                <p className="text-sm text-gray-900">
                  {selectedDocument.file_size 
                    ? `${(selectedDocument.file_size / 1024 / 1024).toFixed(2)} MB`
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Public Access</label>
                <p className="text-sm text-gray-900">
                  {selectedDocument.is_public ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                <p className="text-sm text-gray-900">{formatDate(selectedDocument.created_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <p className="text-sm text-gray-900">{formatDate(selectedDocument.updated_at)}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowDocumentModal(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setShowDocumentModal(false);
                handleEditDocument(selectedDocument);
              }}>
                Edit Document
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document Edit Modal */}
      <DocumentEditModal
        isOpen={showEditDocumentModal}
        onClose={() => {
          setShowEditDocumentModal(false);
          setDocumentToEdit(null);
        }}
        document={documentToEdit}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDocumentToDelete(null);
        }}
        title="Delete Document"
        maxWidth="md"
      >
        {documentToDelete && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Are you sure you want to delete this document?
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This action cannot be undone. The document and all associated data will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-900">Document to be deleted:</p>
              <p className="text-sm text-gray-700">{documentToDelete.title}</p>
              {documentToDelete.citation && (
                <p className="text-xs text-gray-500">{documentToDelete.citation}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDocumentToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteDocument}
                loading={deleting}
              >
                Delete Document
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          // Refresh documents list after upload
          loadDocuments();
        }}
      />
    </div>
  );
}