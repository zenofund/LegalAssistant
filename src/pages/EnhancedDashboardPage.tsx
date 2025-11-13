import React, { useState, useEffect } from 'react';
import { Menu, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { EnhancedSidebar } from '../components/layout/EnhancedSidebar';
import { EnhancedChatInterface } from '../components/chat/EnhancedChatInterface';
import { UploadModal } from '../components/documents/UploadModal';
import { SettingsModal } from '../components/settings/SettingsModal';
import { SubscriptionManager } from '../components/subscription/SubscriptionManager';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { ChatHistoryModal } from '../components/chat/ChatHistoryModal';
import { ArchivedChatsModal } from '../components/chat/ArchivedChatsModal';
import { CaseSummarizerModal } from '../components/chat/CaseSummarizerModal';
import { CaseBriefGeneratorModal } from '../components/chat/CaseBriefGeneratorModal';
import { Button } from '../components/ui/Button';
import { DynamicLogo } from '../components/ui/DynamicLogo';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasPermission } from '../lib/supabase';

export function EnhancedDashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCaseSummarizer, setShowCaseSummarizer] = useState(false);
  const [showCaseBriefGenerator, setShowCaseBriefGenerator] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'verifying' | 'success' | 'failed' | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'admin'>('chat');
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handlePaymentRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentParam = urlParams.get('payment');
      const reference = urlParams.get('reference');
      const trxref = urlParams.get('trxref');

      if (paymentParam === 'success' && (reference || trxref)) {
        const txRef = reference || trxref;
        console.log('💳 Payment redirect detected:', txRef);
        setPaymentStatus('verifying');

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session');
          }

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ reference: txRef }),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to verify payment');
          }

          const verificationData = await response.json();

          if (verificationData.success) {
            console.log('✅ Payment verified successfully');

            await refreshProfile();

            setPaymentStatus('success');
            setPaymentMessage(
              verificationData.alreadyProcessed
                ? 'Payment already processed. Your subscription is active.'
                : 'Payment successful! Your subscription has been activated.'
            );

            setTimeout(() => {
              setPaymentStatus(null);
              window.history.replaceState({}, document.title, window.location.pathname);
            }, 5000);
          } else {
            throw new Error(verificationData.message || 'Payment verification failed');
          }
        } catch (error) {
          console.error('❌ Payment verification error:', error);
          setPaymentStatus('failed');
          setPaymentMessage(
            error instanceof Error && error.message.includes('already processed')
              ? 'This payment has already been processed.'
              : 'Payment verification failed. Please contact support if you were charged.'
          );

          setTimeout(() => {
            setPaymentStatus(null);
            window.history.replaceState({}, document.title, window.location.pathname);
          }, 8000);
        }
      }
    };

    handlePaymentRedirect();

    const handleOpenSettings = () => {
      setShowAdmin(false);
      setShowSettings(true);
    };

    window.addEventListener('openSettings', handleOpenSettings);

    return () => {
      window.removeEventListener('openSettings', handleOpenSettings);
    };
  }, []);

  if (!profile) return null;

  // Check if user has admin or super_admin role
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  // If in admin mode and user is admin, show admin dashboard
  if (viewMode === 'admin' && isAdmin) {
    return (
      <div className="h-screen flex bg-gray-50 dark:bg-dark-primary">
        <AdminDashboard onClose={() => setViewMode('chat')} />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-dark-primary transition-colors duration-200">
      {paymentStatus && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top">
          <div
            className={`rounded-lg shadow-lg p-4 flex items-start space-x-3 ${
              paymentStatus === 'verifying'
                ? 'bg-blue-50 border border-blue-200'
                : paymentStatus === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {paymentStatus === 'verifying' ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Verifying Payment</p>
                  <p className="text-sm text-blue-700">Please wait while we confirm your payment...</p>
                </div>
              </>
            ) : paymentStatus === 'success' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Payment Successful</p>
                  <p className="text-sm text-green-700">{paymentMessage}</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Payment Failed</p>
                  <p className="text-sm text-red-700">{paymentMessage}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ErrorBoundary
        fallback={
          <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 bg-white border-r border-gray-200">
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Sidebar Error</h3>
                <p className="text-gray-600 mb-4 text-sm">
                  The sidebar encountered an error. Please refresh the page to restore functionality.
                </p>
                <Button onClick={() => window.location.reload()} size="sm">
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        }
      >
        <EnhancedSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
          onShowUpload={() => setShowUpload(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowSubscription={() => setShowSubscription(true)}
          onShowAdmin={() => setViewMode('admin')}
          onShowHistory={() => setShowHistory(true)}
          onShowArchived={() => setShowArchived(true)}
          onShowCaseSummarizer={() => setShowCaseSummarizer(true)}
          onShowCaseBriefGenerator={() => setShowCaseBriefGenerator(true)}
        />
      </ErrorBoundary>

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'}`}>
        {/* Mobile Header */}
        <div className="lg:hidden bg-white dark:bg-dark-secondary border-b border-gray-200 dark:border-dark-primary px-4 py-3 flex items-center justify-between transition-colors duration-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="p-2"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <DynamicLogo className="w-24 h-auto rounded object-contain" />

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
            <EnhancedChatInterface onShowSubscription={() => setShowSubscription(true)} />
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

      <ChatHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      <ArchivedChatsModal
        isOpen={showArchived}
        onClose={() => setShowArchived(false)}
      />

      <CaseSummarizerModal
        isOpen={showCaseSummarizer}
        onClose={() => setShowCaseSummarizer(false)}
      />

      <CaseBriefGeneratorModal
        isOpen={showCaseBriefGenerator}
        onClose={() => setShowCaseBriefGenerator(false)}
      />
    </div>
  );
}