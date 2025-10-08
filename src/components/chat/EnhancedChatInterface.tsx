import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Loader2,
  FileText,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Download,
  BookOpen,
  Scale,
  Calendar,
  MapPin,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Quote,
  Gavel,
  Sparkles,
  Upload,
  ChevronUp,
  ArrowUp,
  Mic,
  ChevronDown
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Tooltip } from '../ui/Tooltip';
import { VoiceDictationButton } from '../ui/VoiceDictationButton';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore } from '../../stores/chatStore';
import { CitationGeneratorModal } from './CitationGeneratorModal';
import { CaseSummarizerModal } from './CaseSummarizerModal';
import { CaseBriefGeneratorModal } from './CaseBriefGeneratorModal';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { UploadModal } from '../documents/UploadModal';
import { DynamicLogo } from '../ui/DynamicLogo';
import { formatDate, cn, hasPremiumAccess } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, DocumentSource } from '../../types/database';

interface EnhancedChatInterfaceProps {
  onShowSubscription?: () => void;
}

export function EnhancedChatInterface({ onShowSubscription }: EnhancedChatInterfaceProps = {}) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCitationGenerator, setShowCitationGenerator] = useState(false);
  const [showCaseSummarizer, setShowCaseSummarizer] = useState(false);
  const [showCaseBriefGenerator, setShowCaseBriefGenerator] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [usageData, setUsageData] = useState({ current: 0, max: 50 });
  const [limitError, setLimitError] = useState<any>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { profile } = useAuth();
  const { currentSession, messages, sendMessage, createNewSession, loadSession } = useChatStore();
  const { showError, showWarning } = useToast();

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // Improved scroll detection with throttling
  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Use a smaller, more precise threshold (20px instead of 100px)
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 20;
    
    // Only show button if there are messages and user is not at bottom
    const shouldShowButton = messages.length > 0 && !isAtBottom;
    
    setShowScrollButton(shouldShowButton);
  }, [messages.length]);

  // Throttled scroll handler for better performance
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      checkScrollPosition();
    }, 16); // ~60fps throttling
  }, [checkScrollPosition]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    checkScrollPosition();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, checkScrollPosition]);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        
        // If input is focused, scroll to bottom when keyboard opens/closes
        if (isInputFocused) {
          setTimeout(() => {
            scrollToBottom('auto');
          }, 100);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, [isInputFocused]);

  const handleTextareaFocus = () => {
    setIsInputFocused(true);
    
    // Multiple scroll attempts to ensure visibility
    setTimeout(() => {
      scrollToBottom('auto');
    }, 100);
    
    setTimeout(() => {
      scrollToBottom('auto');
    }, 300);
    
    setTimeout(() => {
      scrollToBottom('auto');
    }, 500);
  };

  const handleTextareaBlur = () => {
    setIsInputFocused(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  useEffect(() => {
    if (profile) {
      loadUsageData();
    }
  }, [profile]);

  const loadUsageData = async () => {
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
          max: data.max_limit === -1 ? -1 : (data.max_limit || 50)
        });
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading || !profile) return;

    setIsLoading(true);
    
    try {
      let sessionId = currentSession;
      if (!sessionId) {
        sessionId = await createNewSession();
      }

      await sendMessage(sessionId, message.trim());
      setMessage('');
      await loadUsageData();
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        if (errorMessage.includes('CHAT_LIMIT_REACHED:')) {
          const cleanMessage = errorMessage.replace('CHAT_LIMIT_REACHED:', '');
          try {
            const errorData = JSON.parse(errorMessage.split('CHAT_LIMIT_REACHED:')[1] || '{}');
            setLimitError(errorData);
            setShowUpgradeModal(true);
          } catch {
            showWarning('Daily Chat Limit Reached', cleanMessage);
          }
        } else if (errorMessage.includes('AI_RATE_LIMIT:')) {
          const cleanMessage = errorMessage.replace('AI_RATE_LIMIT:', '');
          showWarning('Rate Limit Exceeded', cleanMessage);
        } else if (errorMessage.includes('AI_SERVER_ERROR:')) {
          const cleanMessage = errorMessage.replace('AI_SERVER_ERROR:', '');
          showError('AI Service Unavailable', cleanMessage);
        } else if (errorMessage.includes('User not authenticated')) {
          showError('Authentication Required', 'Please sign in to continue chatting.');
        } else if (errorMessage.includes('Failed to load user profile')) {
          showError('Profile Error', 'Unable to load your profile. Please refresh the page and try again.');
      } else {
          showError('Message Failed', 'Failed to send message. Please check your connection and try again.');
        }
      } else {
        showError('Unexpected Error', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyMessage = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy text:', error);
      return false;
    }
  };

  const regenerateResponse = async (messageId: string) => {
    if (!profile || !currentSession) return;

    try {
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1 || messageIndex === 0) return;

      const userMessage = messages[messageIndex - 1];
      if (userMessage.role !== 'user') return;

      setIsLoading(true);

      await supabase.from('chats').delete().eq('id', messageId);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.message,
          session_id: currentSession,
          user_id: profile.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate response');
      }

      const aiResponse = await response.json();

      const assistantMessage: Omit<ChatMessage, 'id' | 'created_at'> = {
        user_id: profile.id,
        session_id: currentSession,
        message: aiResponse.message,
        role: 'assistant',
        sources: aiResponse.sources || [],
        metadata: aiResponse.metadata || {},
        tokens_used: aiResponse.tokens_used || 0,
        model_used: aiResponse.metadata?.model_used || 'gpt-4o-mini'
      };

      const { data: aiMsgData, error: aiMsgError } = await supabase
        .from('chats')
        .insert(assistantMessage)
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;

      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = aiMsgData;

      await loadSession(currentSession);
      setIsLoading(false);
    } catch (error) {
      console.error('Error regenerating response:', error);
      showError('Regeneration Failed', 'Failed to regenerate response. Please try again.');
      setIsLoading(false);
    }
  };

  const shareConversation = async (messageId: string) => {
    if (!profile || !currentSession) return;

    try {
      setSharingMessage(messageId);

      const shareToken = crypto.randomUUID();

      const { data, error } = await supabase
        .from('shared_conversations')
        .insert({
          session_id: currentSession,
          user_id: profile.id,
          share_token: shareToken,
          is_active: true,
          expires_at: null
        })
        .select()
        .single();

      if (error) throw error;

      const shareLink = `${window.location.origin}/shared/${shareToken}`;
      setShareUrl(shareLink);
      setShareModalOpen(true);
    } catch (error) {
      console.error('Error sharing conversation:', error);
      showError('Share Failed', 'Failed to create share link. Please try again.');
    } finally {
      setSharingMessage(null);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showWarning('Link Copied', 'Share link copied to clipboard');
    } catch (error) {
      showError('Copy Failed', 'Failed to copy link to clipboard');
    }
  };

  const submitFeedback = async (messageId: string, feedbackType: 'positive' | 'negative') => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('message_feedback')
        .upsert({
          user_id: profile.id,
          message_id: messageId,
          feedback_type: feedbackType
        }, {
          onConflict: 'user_id,message_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const exportChat = () => {
    const chatContent = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.message}`)
      .join('\n\n');
    
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCitationGenerated = (citation: string) => {
    setMessage(prev => prev + (prev ? '\n\n' : '') + `Generated Citation: ${citation}`);
  };

  const handleUpgradeClick = () => {
    setShowUpgradeModal(false);
    window.location.href = '/dashboard?showSubscription=true';
  };

  const currentPlan = profile?.subscription?.plan;
  const hasCitationGenerator = currentPlan?.tier === 'pro' || currentPlan?.tier === 'enterprise';
  const hasProFeatures = currentPlan?.tier === 'pro' || currentPlan?.tier === 'enterprise';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const showUsage = !isAdmin && usageData.max !== -1;
  const showAITools = hasPremiumAccess(currentPlan?.tier, profile?.role);

  if (!profile) return null;

  return (
    <div
      className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900"
      style={{ height: `${viewportHeight}px` }}
    >
      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto scrollbar-conditional relative">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={setMessage} />
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {messages.map((msg) => (
                  <EnhancedMessageBubble
                    key={msg.id}
                    message={msg}
                    onCopy={copyMessage}
                    onRegenerate={regenerateResponse}
                    onShare={shareConversation}
                    onFeedback={submitFeedback}
                    sharingMessage={sharingMessage}
                    userPlan={profile?.subscription?.plan}
                  />
                ))}
              </AnimatePresence>
              
              {isLoading && <LoadingIndicator />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Improved Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  duration: 0.3
                }
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.8, 
                y: 20,
                transition: {
                  duration: 0.2,
                  ease: "easeInOut"
                }
              }}
              whileHover={{ 
                scale: 1.1,
                transition: { duration: 0.15 }
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollToBottom('smooth')}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 z-20 w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
              title="Scroll to bottom"
              aria-label="Scroll to bottom of chat"
            >
              <ChevronDown className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              
              {/* Subtle pulse animation */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="bg-transparent mb-[50px]">
        <div className="max-w-4xl mx-auto px-4 py-4 bg-white dark:bg-gray-800 rounded-t-2xl">
          
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-end bg-gray-100 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleTextareaFocus}
                onBlur={handleTextareaBlur}
                placeholder="Ask about Nigerian law, upload documents, or use AI tools..."
                className="flex-1 bg-transparent border-none outline-none resize-none px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 min-h-[48px] max-h-[120px]"
                rows={1}
                disabled={isLoading}
              />

              {/* Inline Actions */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Tools Menu Button - Only show for Pro/Enterprise users */}
                {showAITools && (
                  <div className="relative">
                    <Tooltip content="Legal Tools" position="top">
                      <button
                        type="button"
                        onClick={() => setShowToolsMenu(!showToolsMenu)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        aria-label="Open Legal Tools"
                      >
                        <Sparkles className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      </button>
                    </Tooltip>

                    {/* Tools Popup Menu */}
                    <AnimatePresence>
                      {showToolsMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col space-y-2 whitespace-nowrap min-w-[140px] max-h-[80vh] overflow-y-auto"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowUploadModal(true);
                              setShowToolsMenu(false);
                            }}
                            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                            title="Upload Document"
                          >
                            <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Upload</span>
                          </button>
                          {hasCitationGenerator && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowCitationGenerator(true);
                                setShowToolsMenu(false);
                              }}
                              className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                              title="Legal Citation"
                            >
                              <Quote className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Citation</span>
                            </button>
                          )}
                          {hasProFeatures && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCaseSummarizer(true);
                                  setShowToolsMenu(false);
                                }}
                                className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                                title="Case Summarizer"
                              >
                                <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Summarizer</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCaseBriefGenerator(true);
                                  setShowToolsMenu(false);
                                }}
                                className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full text-left"
                                title="Brief Generator"
                              >
                                <Gavel className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Brief</span>
                              </button>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Download Button */}
                {messages.length > 0 && (
                  <Tooltip content="Export Chat" position="top">
                    <button
                      type="button"
                      onClick={exportChat}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      aria-label="Export Chat"
                    >
                      <Download className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  </Tooltip>
                )}

                {/* Voice Dictation Button */}
                {!message.trim() && (
                  <VoiceDictationButton
                    onTranscriptionComplete={(text) => {
                      setMessage(prev => prev ? `${prev} ${text}` : text);
                      setTimeout(() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                        }
                      }, 100);
                    }}
                    userProfile={profile}
                    disabled={isLoading}
                  />
                )}

                {/* Send Button */}
                {message.trim() && (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                      "bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100"
                    )}
                    title="Send Message"
                  >
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div
                          key="loading"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Loader2 className="h-4 w-4 text-white dark:text-gray-900 animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="send"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ArrowUp className="h-4 w-4 text-white dark:text-gray-900" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Citation Generator Modal */}
      <CitationGeneratorModal
        isOpen={showCitationGenerator}
        onClose={() => setShowCitationGenerator(false)}
        onCitationGenerated={handleCitationGenerated}
      />

      {/* Case Summarizer Modal */}
      <CaseSummarizerModal
        isOpen={showCaseSummarizer}
        onClose={() => setShowCaseSummarizer(false)}
      />

      {/* Case Brief Generator Modal */}
      <CaseBriefGeneratorModal
        isOpen={showCaseBriefGenerator}
        onClose={() => setShowCaseBriefGenerator(false)}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgradeClick}
        currentUsage={limitError?.current_usage || usageData.current}
        maxLimit={limitError?.max_limit || usageData.max}
        planTier={limitError?.plan_tier || currentPlan?.tier || 'free'}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Share Conversation
              </h3>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Anyone with this link can view this conversation (login required).
            </p>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                value={shareUrl || ''}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
              <Button onClick={copyShareUrl} variant="default">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={() => setShareModalOpen(false)}
              variant="default"
              className="w-full"
            >
              Close
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    {
      icon: Scale,
      title: "Constitutional Law",
      text: "What are the fundamental rights under the Nigerian Constitution?",
      color: "bg-blue-100 text-blue-600"
    },
    {
      icon: BookOpen,
      title: "Company Law",
      text: "What are the requirements for company incorporation in Nigeria?",
      color: "bg-emerald-100 text-emerald-600"
    },
    {
      icon: Scale,
      title: "Case Analysis",
      text: "Generate a citation for Carlill v. Carbolic Smoke Ball Co. (1893) in NWLR format",
      color: "bg-purple-100 text-purple-600"
    },
    {
      icon: MapPin,
      title: "Land Law",
      text: "How does the Land Use Act affect property ownership in Nigeria?",
      color: "bg-amber-100 text-amber-600"
    }
  ];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mx-auto mb-6 flex items-center justify-center">
            <DynamicLogo className="w-32 h-auto rounded-lg object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to easyAI
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Your AI-powered legal research assistant for Nigerian law.
            Ask questions, analyze cases, or upload documents for instant insights.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onSuggestionClick(suggestion.text)}
                className="text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${suggestion.color} dark:opacity-90`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{suggestion.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{suggestion.text}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-sm text-gray-500"
        >
          <p>💡 Tip: You can also upload legal documents for AI-powered analysis and research</p>
        </motion.div>
      </div>
    </div>
  );
}

function EnhancedMessageBubble({
  message,
  onCopy,
  onRegenerate,
  onShare,
  onFeedback,
  sharingMessage,
  userPlan
}: {
  message: ChatMessage;
  onCopy: (text: string, messageId: string) => Promise<boolean>;
  onRegenerate: (messageId: string) => void;
  onShare: (messageId: string) => void;
  onFeedback: (messageId: string, feedbackType: 'positive' | 'negative') => void;
  sharingMessage: string | null;
  userPlan?: any;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const handleCopy = async () => {
    const success = await onCopy(message.message, message.id);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback(message.id, type);
  };

  const getModelDisplayName = (modelName: string | null) => {
    if (!modelName) return 'GPT-4o-mini';

    const modelMap: Record<string, string> = {
      'gpt-5': 'GPT-5',
      'gpt-5-mini': 'GPT-5 Mini',
      'gpt-5-nano': 'GPT-5 Nano',
      'gpt-4o-mini': 'GPT-4o-mini',
      'gpt-4o': 'GPT-4o',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
    };

    return modelMap[modelName] || modelName.toUpperCase();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`max-w-4xl w-full rounded-2xl px-6 py-4 ${
          message.role === 'user'
            ? 'bg-blue-600 dark:bg-blue-500 text-white ml-12'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mr-12 shadow-sm dark:shadow-gray-900/50'
        }`}
      >
        {/* Message Content */}
        <div className={`prose prose-sm max-w-none ${
          message.role === 'user'
            ? 'prose-invert'
            : 'prose-gray dark:prose-invert'
        }`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.message}
          </ReactMarkdown>
        </div>

        {/* Message Metadata */}
        {message.role === 'assistant' && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{getModelDisplayName(message.model_used)}</span>
              {message.tokens_used && (
                <span>{message.tokens_used.toLocaleString()} tokens</span>
              )}
              <span>{formatDate(message.created_at)}</span>
            </div>

            {/* Action Buttons */}
            <AnimatePresence>
              {showActions && message.role === 'assistant' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center space-x-2"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="p-1 h-6 w-6 relative"
                  >
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Check className="h-3 w-3 text-green-600" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Copy className="h-3 w-3" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRegenerate(message.id)}
                    className="p-1 h-6 w-6"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onShare(message.id)}
                    className="p-1 h-6 w-6"
                    disabled={sharingMessage === message.id}
                  >
                    {sharingMessage === message.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Share2 className="h-3 w-3" />
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Sources
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {message.sources.length} legal {message.sources.length === 1 ? 'reference' : 'references'} found
                  </p>
                </div>
              </div>
              {message.sources.length > 3 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  +{message.sources.length - 3} more
                </span>
              )}
            </div>
            <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              {message.sources.slice(0, 3).map((source, index) => (
                <EnhancedSourceCard key={index} source={source} index={index + 1} />
              ))}
            </div>
          </div>
        )}

        {/* Feedback Buttons */}
        {message.role === 'assistant' && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Was this helpful?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('positive')}
                className={cn(
                  "p-1 h-6 w-6",
                  feedback === 'positive' && "text-green-600 dark:text-green-400"
                )}
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('negative')}
                className={cn(
                  "p-1 h-6 w-6",
                  feedback === 'negative' && "text-red-600 dark:text-red-400"
                )}
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EnhancedSourceCard({ source, index }: { source: DocumentSource; index: number }) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);

  const handleSourceClick = () => {
    if (source.id) {
      window.open(`/document/${source.id}`, '_blank');
    }
  };

  const getTypeColor = () => {
    switch (source.type) {
      case 'case':
        return 'text-blue-600 dark:text-blue-400';
      case 'statute':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'regulation':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <div className="flex items-start space-x-3">
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0">
          {index}.
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <button
              onClick={handleSourceClick}
              className="text-left flex-1 group/link"
            >
              <h4 className={`text-sm font-semibold ${getTypeColor()} group-hover/link:underline transition-all line-clamp-2`}>
                {source.title}
              </h4>
            </button>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                {Math.round(source.relevance_score * 100)}%
              </span>
              <button
                onClick={handleSourceClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Open source"
              >
                <ExternalLink className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {source.citation && (
            <div className="mb-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800/50 px-2 py-1 rounded inline-block">
                {source.citation}
              </p>
            </div>
          )}

          {source.excerpt && (
            <p className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${showFullExcerpt ? '' : 'line-clamp-2'}`}>
              {source.excerpt}
            </p>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
              {source.page && (
                <span className="flex items-center space-x-1">
                  <FileText className="h-3 w-3" />
                  <span>Page {source.page}</span>
                </span>
              )}
              <span className="capitalize">{source.type}</span>
            </div>

            {source.excerpt && source.excerpt.length > 150 && (
              <button
                onClick={() => setShowFullExcerpt(!showFullExcerpt)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showFullExcerpt ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 mr-12 shadow-sm">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Analyzing your question...</span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>🔍 Searching legal database</span>
              <span>🤖 Generating response</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
