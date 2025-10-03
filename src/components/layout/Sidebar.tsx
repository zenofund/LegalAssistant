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
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { useChatStore } from '../../stores/chatStore';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowUpload: () => void;
  onShowSettings: () => void;
}

export function Sidebar({ isOpen, onToggle, onShowUpload, onShowSettings }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { createNewSession, clearMessages } = useChatStore();
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      loadChatSessions();
    }
  }, [profile]);

  const loadChatSessions = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .limit(20);

    if (data) {
      setChatSessions(data);
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

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
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
          New Chat
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {/* Recent Chats */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent Chats
          </h3>
          <div className="space-y-1">
            {chatSessions.map((session) => (
              <button
                key={session.id}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 truncate"
              >
                <MessageSquare className="h-4 w-4 inline mr-2" />
                {session.title || 'New Conversation'}
              </button>
            ))}
            {chatSessions.length === 0 && (
              <p className="text-sm text-gray-500 px-3 py-2">
                No recent chats
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Tools
          </h3>
          <div className="space-y-1">
            <button
              onClick={onShowUpload}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </button>
            <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 flex items-center">
              <History className="h-4 w-4 mr-2" />
              Chat History
            </button>
          </div>
        </div>
      </nav>

      {/* User Menu */}
      <div className="border-t border-gray-200 p-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.subscription?.plan?.name || 'Free Plan'}
              </p>
            </div>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={onShowSettings}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </button>
            <button
              onClick={signOut}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
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
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="lg:hidden fixed inset-y-0 left-0 w-64 z-50"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}