import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MessageSquare, Clock, Search, Trash2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore } from '../../stores/chatStore';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import { useToast } from '../ui/Toast';

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatHistoryModal({ isOpen, onClose }: ChatHistoryModalProps) {
  const { profile } = useAuth();
  const { loadSession } = useChatStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (isOpen && profile) {
      loadChatHistory();
    }
  }, [isOpen, profile, dateFilter]);

  const loadChatHistory = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      let query = supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });

      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          default:
            startDate = new Date(0);
        }

        query = query.gte('last_message_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
      showError('Load Failed', 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (sessionId: string) => {
    try {
      await loadSession(sessionId);
      onClose();
    } catch (error) {
      console.error('Error loading session:', error);
      showError('Load Failed', 'Failed to load conversation');
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      showSuccess('Deleted', 'Conversation deleted successfully');
      await loadChatHistory();
    } catch (error) {
      console.error('Error deleting session:', error);
      showError('Delete Failed', 'Failed to delete conversation');
    }
  };

  const filteredSessions = sessions.filter((session) =>
    session.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedSessions = filteredSessions.reduce((groups: any, session) => {
    const date = new Date(session.last_message_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else if (date > new Date(today.setDate(today.getDate() - 7))) {
      groupKey = 'Last 7 days';
    } else if (date > new Date(today.setMonth(today.getMonth() - 1))) {
      groupKey = 'Last 30 days';
    } else {
      groupKey = 'Older';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(session);
    return groups;
  }, {});

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chat History" maxWidth="2xl">
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'today', 'week', 'month'] as const).map((filter) => (
              <Button
                key={filter}
                variant={dateFilter === filter ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setDateFilter(filter)}
              >
                {filter === 'all' ? 'All' : filter === 'today' ? 'Today' : filter === 'week' ? 'Week' : 'Month'}
              </Button>
            ))}
          </div>
        </div>

        {/* Sessions List */}
        <div className="max-h-[60vh] overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No conversations found</p>
              {searchTerm && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Try adjusting your search or filters
                </p>
              )}
            </div>
          ) : (
            Object.entries(groupedSessions).map(([groupKey, groupSessions]: [string, any]) => (
              <div key={groupKey}>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {groupKey}
                </h3>
                <div className="space-y-2">
                  {groupSessions.map((session: any) => (
                    <div
                      key={session.id}
                      onClick={() => handleSessionClick(session.id)}
                      className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        {!loading && filteredSessions.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Showing {filteredSessions.length} conversation{filteredSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
