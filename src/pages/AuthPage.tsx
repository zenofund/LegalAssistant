import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, BookOpen, Zap } from 'lucide-react';
import { DynamicLogo } from '../components/ui/DynamicLogo';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-700 flex transition-colors duration-200">
      {/* Left side - Hero content */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-blue-600 to-emerald-600 dark:from-blue-800 dark:to-emerald-800 p-12 items-center justify-center relative overflow-hidden transition-colors duration-200">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative z-10 text-center text-white max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center mb-8">
              <DynamicLogo className="h-16 w-16 object-contain" />
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              AI-Powered Legal Research for Nigerian Professionals
            </h1>
            
            <p className="text-xl text-white/90 mb-8">
              Streamline your legal research with advanced AI, comprehensive case databases, 
              and intelligent document analysis.
            </p>

            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center text-lg"
              >
                <BookOpen className="h-6 w-6 mr-3 text-emerald-200" />
                <span>Comprehensive legal database</span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center text-lg"
              >
                <Zap className="h-6 w-6 mr-3 text-yellow-200" />
                <span>Instant AI-powered insights</span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center text-lg"
              >
                <Scale className="h-6 w-6 mr-3 text-blue-200" />
                <span>Nigerian jurisprudence focus</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white opacity-5 rounded-full"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-white opacity-5 rounded-full"></div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-dark-secondary transition-colors duration-200">
        <div className="w-full max-w-md">
          {isLogin ? (
            <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
          ) : (
            <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  );
}