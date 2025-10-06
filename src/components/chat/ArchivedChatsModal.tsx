import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MessageSquare, Search, Trash2, ArchiveRestore, Clock, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore } from '../../stores/chatStore';
import { formatRelativeTime } from '../../lib/utils';
import { useToast } from '../ui/Toast';

interface ArchivedChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArchivedChatsModal({ isOpen, onClose }: ArchivedChatsModalProps) {
  const { profile } = useAuth();
  const { loadSession } = useChatStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletedSessionId, setDeletedSessionId] = useState<string | null>(null);
  const [unarchivedSessionId, setUnarchivedSessionId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isOpen && profile) {
      loadArchivedChats();
    }
  }, [isOpen, profile]);

  const loadArchivedChats = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_archived', true)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading archived chats:', error);
      showError('Load Failed', 'Failed to load archived chats');
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ is_archived: false })
        .eq('id', sessionId);

      if (error) throw error;

      setUnarchivedSessionId(sessionId);
      setTimeout(() => setUnarchivedSessionId(null), 2000);
      showSuccess('Unarchived', 'Conversation restored to chat list');
      await loadArchivedChats();
    } catch (error) {
      console.error('Error unarchiving session:', error);
      showError('Unarchive Failed', 'Failed to restore conversation');
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to permanently delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setDeletedSessionId(sessionId);
      setTimeout(() => setDeletedSessionId(null), 2000);
      showSuccess('Deleted', 'Conversation deleted permanently');
      await loadArchivedChats();
    } catch (error) {
      console.error('Error deleting session:', error);
      showError('Delete Failed', 'Failed to delete conversation');
    }
  };

  const handleViewSession = async (sessionId: string) => {
    try {
      await loadSession(sessionId);
      onClose();
    } catch (error) {
      console.error('Error loading session:', error);
      showError('Load Failed', 'Failed to load conversation');
    }
  };

  const filteredSessions = sessions.filter((session) =>
    session.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Archived Conversations" maxWidth="2xl">
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search archived conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sessions List */}
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm ? 'No archived conversations found' : 'No archived conversations'}
              </p>
              {searchTerm && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Try adjusting your search
                </p>
              )}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleViewSession(session.id)}
                className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors relative"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {session.title || 'New Conversation'}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{session.message_count} messages</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(session.last_message_at)}</span>
                      </span>
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {deletedSessionId === session.id || unarchivedSessionId === session.id ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="flex items-center justify-center w-16 h-8"
                      >
                        <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </motion.div>
                    ) : (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleUnarchive(session.id, e)}
                          title="Restore conversation"
                        >
                          <ArchiveRestore className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(session.id, e)}
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        {!loading && filteredSessions.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {filteredSessions.length} archived conversation{filteredSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
