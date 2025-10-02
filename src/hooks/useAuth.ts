// src/hooks/useAuth.ts (or your equivalent path)

import { useContext } from 'react';
// Make sure this import path points to your new AuthProvider.tsx file
import { AuthContext, AuthContextType } from '../components/AuthProvider';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
