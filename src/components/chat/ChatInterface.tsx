import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useChatStore } from '../../stores/chatStore';
import { getPersonalizedGreeting } from '../../lib/utils';
import type { ChatMessage, DocumentSource } from '../../types/database';

export function ChatInterface() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { currentSession, messages, sendMessage, createNewSession } = useChatStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {getPersonalizedGreeting(profile?.name)}
              </h3>
              <p className="text-gray-600 mb-6">
                Ask me anything about Nigerian law, legal cases, or upload documents for analysis.
              </p>
              <div className="grid gap-3">
                {[
                  "What are the requirements for company incorporation in Nigeria?",
                  "Explain the doctrine of precedent in Nigerian courts",
                  "What are the fundamental rights under the Nigerian Constitution?"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setMessage(suggestion)}
                    className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
        )}
        
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            <div className="flex-1 min-h-[44px] max-h-32 bg-white border border-gray-300 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask a legal question or describe your research needs..."
                className="w-full px-4 py-3 resize-none border-0 bg-transparent focus:outline-none placeholder-gray-500"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="h-11 w-11 p-0 rounded-lg"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-3xl rounded-2xl px-4 py-3 ${
          message.role === 'user'
            ? 'bg-blue-600 text-white ml-12'
            : 'bg-gray-100 text-gray-900 mr-12'
        }`}
      >
        <div className="prose prose-sm max-w-none">
          {message.message}
        </div>
        
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Sources
            </p>
            {message.sources.map((source, index) => (
              <SourceCard key={index} source={source} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SourceCard({ source }: { source: DocumentSource }) {
  return (
    <div className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {source.title}
        </h4>
        {source.citation && (
          <p className="text-xs text-gray-600 mt-1">{source.citation}</p>
        )}
        <p className="text-sm text-gray-700 mt-2 line-clamp-2">
          {source.excerpt}
        </p>
      </div>
      <div className="flex-shrink-0">
        <button className="p-1 text-gray-400 hover:text-gray-600">
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="bg-gray-100 rounded-2xl px-4 py-3 mr-12">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
          <span className="text-sm text-gray-600">Thinking...</span>
        </div>
      </div>
    </motion.div>
  );
}