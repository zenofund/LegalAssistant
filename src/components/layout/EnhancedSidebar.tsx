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
  Zap,
  Scale,
  Infinity,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, trackUsage } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DynamicLogo } from '../ui/DynamicLogo';
import { useChatStore } from '../../stores/chatStore';
import { formatDate, formatRelativeTime } from '../../lib/utils';

interface EnhancedSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowUpload: () => void;
  onShowSettings: () => void;
  onShowSubscription: () => void;
  onShowAdmin?: () => void;
  onShowHistory: () => void;
  onShowArchived: () => void;
  onShowCaseSummarizer?: () => void;
  onShowCaseBriefGenerator?: () => void;
}

export function EnhancedSidebar({
  isOpen,
  onToggle,
  onShowUpload,
  onShowSettings,
  onShowSubscription,
  onShowAdmin,
  onShowHistory,
  onShowArchived,
  onShowCaseSummarizer,
  onShowCaseBriefGenerator
}: EnhancedSidebarProps) {
  const { profile, signOut } = useAuth();
  const { createNewSession, loadSession, currentSession } = useChatStore();
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [usageData, setUsageData] = useState({ current: 0, max: 50 });

  // Sync selectedSession with currentSession from store
  useEffect(() => {
    setSelectedSession(currentSession);
  }, [currentSession]);

  useEffect(() => {
    if (profile) {
      loadChatUsage();
      loadChatSessions();

      // Set up real-time subscription for chat sessions
      const channel = supabase
        .channel('chat_sessions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_sessions',
            filter: `user_id=eq.${profile.id}`
          },
          () => {
            loadChatSessions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const loadChatUsage = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase.rpc('check_usage_limit', {
        p_user_id: profile.id,
        p_feature: 'chat_message'
      });

      if (error) throw error;

      if (data) {
        setUsageData({
          current: data.current_usage || 0,
          max: data.max_limit || 50
        });
      }
    } catch (error) {
      console.error('Error loading chat usage:', error);
    }
  };

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
      const newSessionId = await createNewSession();
      await trackUsage('chat_session_creation');
      await Promise.all([loadChatSessions(), loadChatUsage()]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshSessions = async () => {
    await loadChatSessions();
  };

  const handleSessionClick = async (sessionId: string) => {
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
  const hasProFeatures = currentPlan?.tier === 'pro' || currentPlan?.tier === 'enterprise';
  const isEnterprise = currentPlan?.tier === 'enterprise';
  const showUsage = !isAdmin && usageData.max !== -1;
  const usagePercentage = usageData.max > 0 ? (usageData.current / usageData.max) * 100 : 0;
  const isNearLimit = usagePercentage >= 80;

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white dark:bg-dark-secondary border-r border-gray-200 dark:border-dark-primary transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-primary">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <DynamicLogo className="w-[120px] h-auto rounded-lg object-contain" />
            <div>
              <div className="flex items-center space-x-1">
                {currentPlan?.tier === 'pro' && (
                  <Zap className="h-3 w-3 text-blue-500" />
                )}
                {currentPlan?.tier === 'enterprise' && (
                  <Crown className="h-3 w-3 text-purple-500" />
                )}
                <span className="text-xs text-gray-500 dark:text-dark-muted">
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
        {!isAdmin && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                <span>Chats: {usageData.current}/</span>
                {isEnterprise ? (
                  <span className="flex items-center space-x-1">
                    <span>Unlimited</span>
                    <Infinity className="h-3 w-3" />
                  </span>
                ) : (
                  <span>{usageData.max}</span>
                )}
              </span>
              {!isEnterprise && isNearLimit && showUsage && (
                <button
                  onClick={onShowSubscription}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Upgrade
                </button>
              )}
            </div>
            {showUsage && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
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
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center space-x-2">
              <History className="h-3.5 w-3.5" />
              <span>Chat History</span>
            </h3>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="p-1"
                onClick={handleRefreshSessions}
                title="Refresh chat sessions"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="p-1"
                onClick={onShowHistory}
                title="View all history"
              >
                <Filter className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start a new chat to begin</p>
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

      {/* Pro Tools Section */}
      {hasProFeatures && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3 flex items-center">
              <Zap className="h-3 w-3 mr-1" />
              Pro Tools
            </h3>
            {onShowCaseSummarizer && (
              <Button
                variant="ghost"
                onClick={onShowCaseSummarizer}
                className="w-full justify-start text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Scale className="h-4 w-4 mr-3" />
                Case Summarizer
              </Button>
            )}
            {onShowCaseBriefGenerator && (
              <Button
                variant="ghost"
                onClick={onShowCaseBriefGenerator}
                className="w-full justify-start text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <BookOpen className="h-4 w-4 mr-3" />
                Brief Generator
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Tools
          </h3>
          <Button
            variant="ghost"
            onClick={onShowHistory}
            className="w-full justify-start text-sm"
          >
            <History className="h-4 w-4 mr-3" />
            Chat History
          </Button>
          <Button
            variant="ghost"
            onClick={onShowArchived}
            className="w-full justify-start text-sm"
          >
            <Archive className="h-4 w-4 mr-3" />
            Archived Chats
          </Button>
        </div>
      </div>

      {/* User Menu */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between space-x-2">
          {/* User Info Button */}
          <Tooltip content={profile?.name || 'User Profile'}>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
              aria-label="User Profile"
            >
              <User className="h-5 w-5 text-white" />
            </button>
          </Tooltip>

          {/* Plan Info Button */}
          <Tooltip content={currentPlan?.name || 'Free Plan'}>
            <button
              onClick={currentPlan?.tier !== 'enterprise' ? onShowSubscription : undefined}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                currentPlan?.tier === 'enterprise'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : currentPlan?.tier === 'pro'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer'
              }`}
              aria-label="Plan Information"
            >
              {currentPlan?.tier === 'enterprise' ? (
                <Crown className="h-5 w-5" />
              ) : currentPlan?.tier === 'pro' ? (
                <Zap className="h-5 w-5" />
              ) : (
                <Crown className="h-5 w-5" />
              )}
            </button>
          </Tooltip>

          {/* Settings Button */}
          <Tooltip content="Settings">
            <button
              onClick={onShowSettings}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </Tooltip>

          {/* Admin Button (if admin) */}
          {isAdmin && (
            <Tooltip content="Admin Dashboard">
              <button
                onClick={onShowAdmin}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
                aria-label="Admin Dashboard"
              >
                <Crown className="h-5 w-5" />
              </button>
            </Tooltip>
          )}

          {/* Logout Button */}
          <Tooltip content="Sign Out">
            <button
              onClick={signOut}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
              aria-label="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </Tooltip>
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

function Tooltip({
  content,
  children
}: {
  content: string;
  children: React.ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none"
          >
            {content}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
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
              isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'
            }`}>
              {session.title || 'New Conversation'}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className={`text-xs truncate ${
                isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {session.message_count} messages
              </p>
              <span className={`text-xs ${
                isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
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
            className="absolute right-2 top-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10"
          >
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                className="w-full text-left px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
              >
                <Archive className="h-3 w-3" />
                <span>Archive</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-full text-left px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center space-x-2"
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
