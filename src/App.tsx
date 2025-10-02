import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './components/AuthProvider';
import { AuthPage } from './pages/AuthPage';
import { EnhancedDashboardPage } from './pages/EnhancedDashboardPage';

function AppContent() {
  const { user, profile, loading } = useAuth();

  console.log('🎯 AppContent: Render state:', {
    loading,
    hasUser: !!user,
    hasProfile: !!profile,
    userId: user?.id,
    profileName: profile?.name
  });

  if (loading) {
    console.log('⏳ AppContent: Showing loading screen');
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    console.log('🔐 AppContent: No user/profile, showing auth page');
    return <AuthPage />;
  }

  console.log('✅ AppContent: User authenticated, showing dashboard');
  return <EnhancedDashboardPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;