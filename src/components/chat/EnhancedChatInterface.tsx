import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Loader2, 
  FileText, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  Download,
  BookOpen,
  Scale,
  Calendar,
  MapPin,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Share2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore } from '../../stores/chatStore';
import { useUsage } from '../../hooks/useUsage'; // FIX: Import the useUsage hook
import { trackUsage } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { ChatMessage, DocumentSource } from '../../types/database';

export function EnhancedChatInterface() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useAuth();
  const { currentSession, messages, sendMessage, createNewSession } = useChatStore();
  
  // FIX: Call the useUsage hook to get usage data and loading state
  const { currentChatCount, maxChatLimit, loadingUsage } = useUsage();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

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
      await trackUsage('chat_message');
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show user-friendly error message for usage limits
      if (error instanceof Error && error.message.includes('Daily chat limit reached')) {
        alert(error.message);
      } else {
        alert('Failed to send message. Please try again.');
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

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy text:', error);
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
          
          {/* Usage indicator */}
          {!loadingUsage && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              {maxChatLimit === -1 ? (
                <span>Unlimited messages</span>
              ) : (
                <span>
                  Daily usage: {currentChatCount}/{maxChatLimit} messages
                  {currentChatCount >= maxChatLimit && (
                    <span className="text-red-600 ml-2">
                      (Limit reached - upgrade for more)
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
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
      icon: FileText,
      title: "Legal Precedents",
      text: "Explain the doctrine of precedent in Nigerian courts",
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
  onRegenerate 
}: { 
  message: ChatMessage;
  onCopy: (text: string) => void;
  onRegenerate: (messageId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

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
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap">{message.message}</div>
        </div>

        {/* Message Metadata */}
        {message.role === 'assistant' && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Model: {message.model_used || 'GPT-4'}</span>
              <span>Tokens: {message.tokens_used}</span>
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
                    onClick={() => onCopy(message.message)}
                    className="p-1 h-6 w-6"
                  >
                    <Copy className="h-3 w-3" />
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
