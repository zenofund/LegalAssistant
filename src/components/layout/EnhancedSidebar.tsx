import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Plus, 
  History, 
  BookOpen, 
  Upload, 
  Settings, 
  User, 
  LogOut,
  Menu,
  X,
  Search,
  Filter,
  Archive,
  Star,
  Trash2,
  MoreHorizontal,
  Crown,
  Zap
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useChatStore } from '../../stores/chatStore';
import { formatDate, formatRelativeTime } from '../../lib/utils';

interface EnhancedSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowUpload: () => void;
  onShowSettings: () => void;
  onShowSubscription: () => void;
  onShowAdmin?: () => void;
}

export function EnhancedSidebar({ 
  isOpen, 
  onToggle, 
  onShowUpload, 
  onShowSettings,
  onShowSubscription,
  onShowAdmin
}: EnhancedSidebarProps) {
  const { profile, signOut } = useAuth();
  const { createNewSession, clearMessages, loadSession } = useChatStore();
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      loadChatSessions();
    }
  }, [profile]);

  const loadChatSessions = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setChatSessions(data || []);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const handleNewChat = async () => {
    setLoading(true);
    try {
      await createNewSession();
      clearMessages();
      await loadChatSessions();
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (sessionId: string) => {
    setSelectedSession(sessionId);
    try {
      await loadSession(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const archiveSession = async (sessionId: string) => {
    try {
      await supabase
        .from('chat_sessions')
        .update({ is_archived: true })
        .eq('id', sessionId);
      
      await loadChatSessions();
    } catch (error) {
      console.error('Error archiving session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);
      
      await loadChatSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const filteredSessions = chatSessions.filter(session =>
    session.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentPlan = profile?.subscription?.plan;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900">easyAI</span>
              <div className="flex items-center space-x-1">
                {currentPlan?.tier === 'pro' && (
                  <Zap className="h-3 w-3 text-blue-500" />
                )}
                {currentPlan?.tier === 'enterprise' && (
                  <Crown className="h-3 w-3 text-purple-500" />
                )}
                <span className="text-xs text-gray-500">
                  {currentPlan?.name || 'Free Plan'}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="lg:hidden p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <Button
          onClick={handleNewChat}
          loading={loading}
          className="w-full justify-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Legal Research
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Recent Conversations
            </h3>
            <Button variant="ghost" size="sm" className="p-1">
              <Filter className="h-3 w-3" />
            </Button>
          </div>
          
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSessions.map((session) => (
                <ChatSessionItem
                  key={session.id}
                  session={session}
                  isSelected={selectedSession === session.id}
                  onClick={() => handleSessionClick(session.id)}
                  onArchive={() => archiveSession(session.id)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-gray-200 p-4">
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Tools
          </h3>
          <Button
            variant="ghost"
            onClick={onShowUpload}
            className="w-full justify-start text-sm"
          >
            <Upload className="h-4 w-4 mr-3" />
            Upload Documents
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
          >
            <History className="h-4 w-4 mr-3" />
            Chat History
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
          >
            <Archive className="h-4 w-4 mr-3" />
            Archived Chats
          </Button>
        </div>
      </div>

      {/* User Menu */}
      <div className="border-t border-gray-200 p-4">
        <div className="space-y-3">
          {/* User Info */}
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-50">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name}
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 truncate">
                  {currentPlan?.name || 'Free Plan'}
                </span>
                {currentPlan?.tier !== 'enterprise' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onShowSubscription}
                    className="text-xs px-2 py-1 h-5 bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              onClick={onShowSettings}
              className="w-full justify-start text-sm"
            >
              <Settings className="h-4 w-4 mr-3" />
              Settings
            </Button>
            
            {isAdmin && (
              <Button
                variant="ghost"
                onClick={onShowAdmin}
                className="w-full justify-start text-sm"
              >
                <Crown className="h-4 w-4 mr-3" />
                Admin Dashboard
              </Button>
            )}
            
            <Button
              variant="ghost"
              onClick={signOut}
              className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              className="lg:hidden fixed inset-y-0 left-0 w-80 z-50"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatSessionItem({ 
  session, 
  isSelected, 
  onClick, 
  onArchive, 
  onDelete 
}: {
  session: any;
  isSelected: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`group relative rounded-lg transition-colors ${
        isSelected 
          ? 'bg-blue-50 border border-blue-200' 
          : 'hover:bg-gray-50 border border-transparent'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-3 focus:outline-none"
      >
        <div className="flex items-start space-x-3">
          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
            isSelected ? 'bg-blue-500' : 'bg-gray-300'
          }`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${
              isSelected ? 'text-blue-900' : 'text-gray-900'
            }`}>
              {session.title || 'New Conversation'}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className={`text-xs truncate ${
                isSelected ? 'text-blue-700' : 'text-gray-500'
              }`}>
                {session.message_count} messages
              </p>
              <span className={`text-xs ${
                isSelected ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {formatRelativeTime(session.last_message_at)}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Actions Menu */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 top-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
          >
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                className="w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Archive className="h-3 w-3" />
                <span>Archive</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-full text-left px-3 py-1 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}