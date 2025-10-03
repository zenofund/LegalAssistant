import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hoverable = false, onClick }: CardProps) {
  const isInteractive = onClick || hoverable;
  
  if (isInteractive) {
    return (
      <motion.div
        className={cn(
          'bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden',
          hoverable && 'cursor-pointer transition-all duration-200',
          className
        )}
        onClick={onClick}
        whileHover={hoverable ? { scale: 1.02, shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' } : undefined}
        whileTap={hoverable ? { scale: 0.98 } : undefined}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-200 dark:border-gray-700', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700', className)}>
      {children}
    </div>
  );
}