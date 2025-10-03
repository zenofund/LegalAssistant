import React, { useState, useCallback, useEffect } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { supabase, trackUsage } from '../../lib/supabase';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FileUpload {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  id: string;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentDocumentCount, setCurrentDocumentCount] = useState(0);
  const [maxDocumentLimit, setMaxDocumentLimit] = useState(10);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (isOpen && profile) {
      loadCurrentUsage();
    }
  }, [isOpen, profile]);

  const loadCurrentUsage = async () => {
    if (!profile) return;

    setLoadingUsage(true);
    try {
      // Get current document count
      const { count, error } = await supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .eq('uploaded_by', profile.id);

      if (error) throw error;

      setCurrentDocumentCount(count || 0);

      // Get max document limit from current plan
      const currentPlan = profile.subscription?.plan;
      setMaxDocumentLimit(currentPlan?.max_documents || 10);

    } catch (error) {
      console.error('Error loading document usage:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = newFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        alert(`File type not supported: ${file.name}`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`File too large: ${file.name} (max 10MB)`);
        return false;
      }
      return true;
    });

    const fileUploads: FileUpload[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
      id: Math.random().toString(36).substr(2, 9)
    }));

    setFiles(prev => [...prev, ...fileUploads]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFile = async (fileUpload: FileUpload) => {
    if (!profile) return;

    // Check document upload limits
    const currentPlan = profile.subscription?.plan;
    if (currentPlan && currentPlan.max_documents !== -1) {
      try {
        const { count, error: countError } = await supabase
          .from('documents')
          .select('id', { count: 'exact' })
          .eq('uploaded_by', profile.id);

        if (countError) throw countError;

        if ((count || 0) >= currentPlan.max_documents) {
          setFiles(prev => prev.map(f => 
            f.id === fileUpload.id 
              ? { 
                  ...f, 
                  status: 'error', 
                  error: `Document limit reached (${currentPlan.max_documents}). Upgrade your plan for more uploads.`
                }
              : f
          ));
          return;
        }
      } catch (error) {
        console.error('Error checking document limits:', error);
        setFiles(prev => prev.map(f => 
          f.id === fileUpload.id 
            ? { 
                ...f, 
                status: 'error', 
                error: 'Failed to check upload limits. Please try again.'
              }
            : f
        ));
        return;
      }
    }

    try {
      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // Upload file to Supabase Storage
      const fileName = `${Date.now()}-${fileUpload.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, fileUpload.file);

      if (uploadError) throw uploadError;

      // Get file content for processing
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      formData.append('fileName', fileName);
      formData.append('userId', profile.id);

      // Call RAG ingestion function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-ingestion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Failed to process document';
        
        try {
          const errorData = await response.json();
          
          if (errorData.code === 'WORKER_LIMIT') {
            errorMessage = 'File is too large or complex to process. Try uploading a smaller file or contact support for assistance.';
          } else if (errorData.details) {
            errorMessage = errorData.details;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If we can't parse the error response, use status-based messages
          if (response.status === 413) {
            errorMessage = 'File is too large. Please try a smaller file.';
          } else if (response.status === 429) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error occurred. Please try again later or contact support.';
          } else {
            errorMessage = `Upload failed with status ${response.status}. Please try again.`;
          }
        }
        
        throw new Error(errorMessage);
      }

      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id 
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));

      // Track document upload usage
      await trackUsage('document_upload');
      
      // Update current document count
      setCurrentDocumentCount(prev => prev + 1);

    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id 
          ? { 
              ...f, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed' 
            }
          : f
      ));
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
  };

  const getStatusIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <File className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Documents"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              Drop your legal documents here
            </p>
            <p className="text-sm text-gray-600">
              or <label className="text-blue-600 hover:text-blue-500 cursor-pointer font-medium">
                browse files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-xs text-gray-500">
              Supports PDF, DOCX, and TXT files up to 10MB each
            </p>
            {!loadingUsage && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  Documents uploaded: {currentDocumentCount}
                  {maxDocumentLimit !== -1 ? `/${maxDocumentLimit}` : ' (unlimited)'}
                </p>
                {maxDocumentLimit !== -1 && currentDocumentCount >= maxDocumentLimit && (
                  <p className="text-xs text-red-600 mt-1">
                    Upload limit reached. Upgrade your plan for more uploads.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Files to upload</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((fileUpload) => (
                <div key={fileUpload.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  {getStatusIcon(fileUpload.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileUpload.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(fileUpload.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {fileUpload.error && (
                      <p className="text-xs text-red-600 mt-1">{fileUpload.error}</p>
                    )}
                  </div>
                  {fileUpload.status === 'uploading' && (
                    <div className="w-16 text-xs text-gray-600">
                      {fileUpload.progress}%
                    </div>
                  )}
                  {fileUpload.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(fileUpload.id)}
                      className="p-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {files.some(f => f.status === 'pending') && (
            <Button onClick={uploadAllFiles}>
              Upload All Files
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}