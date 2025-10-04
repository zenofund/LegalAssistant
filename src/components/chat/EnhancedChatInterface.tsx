import React, { useState, useRef, useEffect } from 'react';
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
  Quote
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore } from '../../stores/chatStore';
import { CitationGeneratorModal } from './CitationGeneratorModal';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { formatDate } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, DocumentSource } from '../../types/database';

export function EnhancedChatInterface() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCitationGenerator, setShowCitationGenerator] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [usageData, setUsageData] = useState({ current: 0, max: 50 });
  const [limitError, setLimitError] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useAuth();
  const { currentSession, messages, sendMessage, createNewSession } = useChatStore();
  const { showError, showWarning } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          max: data.max_limit || 50
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
    // Implementation for regenerating AI response
    console.log('Regenerating response for message:', messageId);
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
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const showUsage = !isAdmin && usageData.max !== -1;

  if (!profile) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
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
                    userPlan={profile?.subscription?.plan}
                  />
                ))}
              </AnimatePresence>
              
              {isLoading && <LoadingIndicator />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {showUsage && (
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Daily Usage: <span className="font-semibold">Chats: {usageData.current}/{usageData.max}</span>
              </span>
              {usageData.current >= usageData.max * 0.8 && usageData.current < usageData.max && (
                <span className="text-amber-600 text-xs">
                  {usageData.max - usageData.current} chats remaining today
                </span>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Nigerian law, legal cases, or upload documents for analysis..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                  {hasCitationGenerator && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCitationGenerator(true)}
                      className="p-1"
                      title="Legal Citation Generator"
                    >
                      <Quote className="h-4 w-4" />
                    </Button>
                  )}
                  {messages.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={exportChat}
                      className="p-1"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="h-12 w-12 p-0 rounded-xl"
              >
                <Send className="h-5 w-5" />
              </Button>
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgradeClick}
        currentUsage={limitError?.current_usage || usageData.current}
        maxLimit={limitError?.max_limit || usageData.max}
        planTier={limitError?.plan_tier || currentPlan?.tier || 'free'}
      />
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
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Scale className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to easyAI
          </h1>
          <p className="text-lg text-gray-600 mb-8">
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
                className="text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white"
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${suggestion.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h3>
                    <p className="text-sm text-gray-600">{suggestion.text}</p>
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
  userPlan
}: {
  message: ChatMessage;
  onCopy: (text: string, messageId: string) => Promise<boolean>;
  onRegenerate: (messageId: string) => void;
  userPlan?: any;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopy(message.message, message.id);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getModelDisplayName = (modelName: string | null) => {
    if (!modelName) return 'GPT-4o-mini';

    const modelMap: Record<string, string> = {
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
            ? 'bg-blue-600 text-white ml-12'
            : 'bg-white border border-gray-200 mr-12 shadow-sm'
        }`}
      >
        {/* Message Content */}
        <div className={`prose prose-sm max-w-none ${
          message.role === 'user' 
            ? 'prose-invert' 
            : 'prose-gray'
        }`}>
          {message.role === 'user' ? (
            <div className="whitespace-pre-wrap">{message.message}</div>
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Customize heading styles
                h1: ({children}) => <h1 className="text-xl font-bold mb-3 text-gray-900">{children}</h1>,
                h2: ({children}) => <h2 className="text-lg font-semibold mb-2 text-gray-800">{children}</h2>,
                h3: ({children}) => <h3 className="text-base font-medium mb-2 text-gray-700">{children}</h3>,
                
                // Customize paragraph styles
                p: ({children}) => <p className="mb-3 text-gray-700 leading-relaxed">{children}</p>,
                
                // Customize list styles
                ul: ({children}) => <ul className="mb-3 ml-4 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="mb-3 ml-4 space-y-1">{children}</ol>,
                li: ({children}) => <li className="text-gray-700">{children}</li>,
                
                // Customize emphasis styles
                strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({children}) => <em className="italic text-gray-800">{children}</em>,
                
                // Customize code styles
                code: ({children, className}) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono">
                      {children}
                    </code>
                  ) : (
                    <code className={className}>{children}</code>
                  );
                },
                pre: ({children}) => (
                  <pre className="mb-3 p-3 bg-gray-100 rounded-lg overflow-x-auto">
                    {children}
                  </pre>
                ),
                
                // Customize blockquote styles
                blockquote: ({children}) => (
                  <blockquote className="mb-3 pl-4 border-l-4 border-blue-500 bg-blue-50 py-2 italic text-gray-700">
                    {children}
                  </blockquote>
                ),
                
                // Customize table styles
                table: ({children}) => (
                  <div className="mb-3 overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({children}) => (
                  <thead className="bg-gray-50">{children}</thead>
                ),
                th: ({children}) => (
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-200">
                    {children}
                  </th>
                ),
                td: ({children}) => (
                  <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                    {children}
                  </td>
                ),
                
                // Customize link styles
                a: ({children, href}) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.message}
            </ReactMarkdown>
          )}
        </div>

        {/* Message Metadata */}
        {message.role === 'assistant' && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Model: {getModelDisplayName(message.model_used)}</span>
              <span>{formatDate(message.created_at)}</span>
            </div>
            
            {/* Message Actions */}
            <AnimatePresence>
              {showActions && (
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
                    className="p-1 h-6 w-6"
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Sources ({message.sources.length})
              </span>
            </div>
            <div className="grid gap-3">
              {message.sources.map((source, index) => (
                <EnhancedSourceCard key={index} source={source} />
              ))}
            </div>
          </div>
        )}

        {/* Feedback Buttons */}
        {message.role === 'assistant' && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Was this helpful?</span>
              <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EnhancedSourceCard({ source }: { source: DocumentSource }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            source.type === 'case' 
              ? 'bg-blue-100 text-blue-600'
              : source.type === 'statute'
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {source.type === 'case' ? <Scale className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
              {source.title}
            </h4>
            <div className="flex items-center space-x-2 ml-2">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {Math.round(source.relevance_score * 100)}% match
              </span>
              <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {source.citation && (
            <div className="flex items-center space-x-2 mb-2">
              <BookOpen className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600 font-mono">{source.citation}</span>
            </div>
          )}
          
          <p className="text-sm text-gray-700 line-clamp-3 mb-3">
            {source.excerpt}
          </p>
          
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {source.page && (
              <div className="flex items-center space-x-1">
                <FileText className="h-3 w-3" />
                <span>Page {source.page}</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <Tag className="h-3 w-3" />
              <span className="capitalize">{source.type}</span>
            </div>
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