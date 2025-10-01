import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { ChatInterface } from '../components/chat/ChatInterface';
import { UploadModal } from '../components/documents/UploadModal';
import { SettingsModal } from '../components/settings/SettingsModal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <div className="h-screen flex">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onShowUpload={() => setShowUpload(true)}
        onShowSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="p-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface />
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
    </div>
  );
}