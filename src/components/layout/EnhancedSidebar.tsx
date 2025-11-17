import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, History, BookOpen, Upload, Settings, User, LogOut, Menu, X, Search, Filter, Archive, Star, Trash2, Check, MoreHorizontal, Crown, Zap, Scale, Infinity, RefreshCw, CreditCard as Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
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
  isCollapsed = false,
  onToggleCollapsed,
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

  const [deletedSessionId, setDeletedSessionId] = useState<string | null>(null);
  const [archivedSessionId, setArchivedSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [renamedSessionId, setRenamedSessionId] = useState<string | null>(null);

  const archiveSession = async (sessionId: string) => {
    try {
      await supabase
        .from('chat_sessions')
        .update({ is_archived: true })
        .eq('id', sessionId);

      setArchivedSessionId(sessionId);
      setTimeout(() => setArchivedSessionId(null), 2000);
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

      setDeletedSessionId(sessionId);
      setTimeout(() => setDeletedSessionId(null), 2000);
      await loadChatSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleStartRename = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle || 'New Conversation');
  };

  const handleSaveRename = async (sessionId: string) => {
    if (!editingTitle.trim()) return;

    try {
      await supabase
        .from('chat_sessions')
        .update({ title: editingTitle.trim() })
        .eq('id', sessionId);

      setRenamedSessionId(sessionId);
      setTimeout(() => setRenamedSessionId(null), 2000);
      setEditingSessionId(null);
      setEditingTitle('');
      await loadChatSessions();
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(sessionId);
    } else if (e.key === 'Escape') {
      setEditingSessionId(null);
      setEditingTitle('');
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
      <div className={`border-b border-gray-200 dark:border-dark-primary transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className="flex items-center justify-between mb-3">
          {!isCollapsed && (
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
          )}
          <div className="flex items-center space-x-1">
            {isCollapsed && (
              <Tooltip content={currentPlan?.name || 'Free Plan'}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                  {currentPlan?.tier === 'pro' && (
                    <Zap className="h-4 w-4 text-blue-500" />
                  )}
                  {currentPlan?.tier === 'enterprise' && (
                    <Crown className="h-4 w-4 text-purple-500" />
                  )}
                  {!currentPlan?.tier && (
                    <Crown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </Tooltip>
            )}
            <Tooltip content={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <button
                onClick={onToggleCollapsed}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                aria-label="Toggle sidebar"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </Tooltip>
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
        {!isAdmin && !isCollapsed && (
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
      <div className={`transition-all duration-300 ${isCollapsed ? 'px-2 py-2' : 'p-4'}`}>
        {isCollapsed ? (
          <Tooltip content="New Legal Research">
            <button
              onClick={handleNewChat}
              disabled={loading}
              className="w-full flex items-center justify-center p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50"
              aria-label="New Legal Research"
            >
              <Plus className="h-5 w-5" />
            </button>
          </Tooltip>
        ) : (
          <Button
            onClick={handleNewChat}
            loading={loading}
            className="w-full justify-start"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Legal Research
          </Button>
        )}
      </div>

      {/* Search */}
      {!isCollapsed && (
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
      )}

      {/* Chat History */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4">
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
                    onRename={(e) => handleStartRename(session.id, session.title, e)}
                    showDeleteSuccess={deletedSessionId === session.id}
                    showArchiveSuccess={archivedSessionId === session.id}
                    showRenameSuccess={renamedSessionId === session.id}
                    isEditing={editingSessionId === session.id}
                    editingTitle={editingTitle}
                    onEditingTitleChange={setEditingTitle}
                    onSaveRename={() => handleSaveRename(session.id)}
                    onRenameKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flex spacer - only visible when collapsed to push tools to bottom */}
      {isCollapsed && <div className="flex-1" />}

      {/* Quick Actions / Tools */}
      <div className={`border-t border-gray-200 dark:border-gray-700 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {!isCollapsed && (
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Tools
          </h3>
        )}
        <div className={`space-y-1 ${isCollapsed ? 'space-y-2' : ''}`}>
          <Tooltip content="Chat History">
            <button
              onClick={onShowHistory}
              className={`flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${
                isCollapsed
                  ? 'w-full p-2 justify-center'
                  : 'w-full justify-start text-sm py-2 px-3'
              }`}
              aria-label="Chat History"
            >
              <History className={isCollapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'} />
              {!isCollapsed && 'Chat History'}
            </button>
          </Tooltip>
          <Tooltip content="Archived Chats">
            <button
              onClick={onShowArchived}
              className={`flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${
                isCollapsed
                  ? 'w-full p-2 justify-center'
                  : 'w-full justify-start text-sm py-2 px-3'
              }`}
              aria-label="Archived Chats"
            >
              <Archive className={isCollapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'} />
              {!isCollapsed && 'Archived Chats'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* User Menu */}
      <div className={`border-t border-gray-200 dark:border-gray-700 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'flex-col space-y-1' : 'justify-between space-x-2'}`}>
          {/* User Info Button */}
          <Tooltip content={profile?.name || 'User Profile'}>
            <button
              className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all ${
                isCollapsed ? 'w-8 h-8' : 'w-10 h-10'
              }`}
              aria-label="User Profile"
            >
              <User className={`text-white ${isCollapsed ? 'h-4 w-4' : 'h-5 w-5'}`} />
            </button>
          </Tooltip>

          {/* Plan Info Button */}
          {!isCollapsed && (
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
          )}

          {/* Settings Button */}
          <Tooltip content="Settings">
            <button
              onClick={onShowSettings}
              className={`flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${
                isCollapsed ? 'w-8 h-8' : 'w-10 h-10'
              }`}
              aria-label="Settings"
            >
              <Settings className={isCollapsed ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          </Tooltip>

          {/* Admin Button (if admin) */}
          {isAdmin && (
            <Tooltip content="Admin Dashboard">
              <button
                onClick={onShowAdmin}
                className={`flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all ${
                  isCollapsed ? 'w-8 h-8' : 'w-10 h-10'
                }`}
                aria-label="Admin Dashboard"
              >
                <Crown className={isCollapsed ? 'h-4 w-4' : 'h-5 w-5'} />
              </button>
            </Tooltip>
          )}

          {/* Logout Button */}
          <Tooltip content="Sign Out">
            <button
              onClick={signOut}
              className={`flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all ${
                isCollapsed ? 'w-8 h-8' : 'w-10 h-10'
              }`}
              aria-label="Sign Out"
            >
              <LogOut className={isCollapsed ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Always visible on large screens */}
      <motion.div
        initial={false}
        animate={{ width: isCollapsed ? 64 : 320 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden lg:block lg:fixed lg:inset-y-0 lg:z-50 overflow-hidden"
      >
        {sidebarContent}
      </motion.div>

      {/* Mobile Sidebar - Only visible when toggled */}
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
              transition={{
                type: "tween",
                ease: [0.25, 0.1, 0.25, 1],
                duration: 0.3
              }}
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
  onDelete,
  onRename,
  showDeleteSuccess,
  showArchiveSuccess,
  showRenameSuccess,
  isEditing,
  editingTitle,
  onEditingTitleChange,
  onSaveRename,
  onRenameKeyDown
}: {
  session: any;
  isSelected: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRename: (e: React.MouseEvent) => void;
  showDeleteSuccess?: boolean;
  showArchiveSuccess?: boolean;
  showRenameSuccess?: boolean;
  isEditing?: boolean;
  editingTitle?: string;
  onEditingTitleChange?: (title: string) => void;
  onSaveRename?: () => void;
  onRenameKeyDown?: (e: React.KeyboardEvent) => void;
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
        onClick={isEditing ? undefined : onClick}
        className="w-full text-left px-3 py-2 focus:outline-none"
      >
        <div className="flex items-start space-x-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
            isSelected ? 'bg-blue-500' : 'bg-gray-300'
          }`} />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => {
                  e.stopPropagation();
                  onEditingTitleChange?.(e.target.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  onRenameKeyDown?.(e);
                }}
                onBlur={(e) => {
                  e.stopPropagation();
                  onSaveRename?.();
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className={`text-sm font-medium truncate ${
                isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {session.title || 'New Conversation'}
              </p>
            )}
            <div className="flex items-center justify-between mt-0.5">
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
        {showActions && !showDeleteSuccess && !showArchiveSuccess && !showRenameSuccess && !isEditing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 top-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10"
          >
            <div className="py-1">
              <button
                onClick={onRename}
                className="w-full text-left px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
              >
                <Edit2 className="h-3 w-3" />
                <span>Rename</span>
              </button>
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

        {/* Success Feedback */}
        {(showDeleteSuccess || showArchiveSuccess || showRenameSuccess) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 top-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg shadow-lg z-10 px-2 py-1"
          >
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
