import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { EnhancedSidebar } from '../components/layout/EnhancedSidebar';
import { EnhancedChatInterface } from '../components/chat/EnhancedChatInterface';
import { UploadModal } from '../components/documents/UploadModal';
import { SettingsModal } from '../components/settings/SettingsModal';
import { SubscriptionManager } from '../components/subscription/SubscriptionManager';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { Button } from '../components/ui/Button';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/supabase';

export function EnhancedDashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const { profile } = useAuth();

  if (!profile) return null;

  const isAdmin = hasPermission(profile.role, ['admin', 'super_admin']);

  // Show admin dashboard if requested and user has permission
  if (showAdmin && isAdmin) {
    return <AdminDashboard />;
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <EnhancedSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onShowUpload={() => setShowUpload(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowSubscription={() => setShowSubscription(true)}
        onShowAdmin={() => setShowAdmin(true)}
      />

      <div className="flex-1 lg:ml-80 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="p-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-emerald-600 rounded flex items-center justify-center">
              <span className="text-xs font-bold text-white">AI</span>
            </div>
            <span className="font-semibold text-gray-900">easyAI</span>
          </div>
          
          <div className="w-8" /> {/* Spacer for centering */}
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ErrorBoundary
            fallback={
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md p-8">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Chat Interface Error</h2>
                  <p className="text-gray-600 mb-4">
                    The chat interface encountered an error. Please refresh the page to continue.
                  </p>
                  <Button onClick={() => window.location.reload()}>
                    Refresh Page
                  </Button>
                </div>
              </div>
            }
          >
            <EnhancedChatInterface />
          </ErrorBoundary>
        </main>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
      />
      
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <SubscriptionManager
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
      />
    </div>
  );
}