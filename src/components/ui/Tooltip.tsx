import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setShouldRender(true);
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setTimeout(() => setShouldRender(false), 200);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  const getArrowStyles = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-gray-700';
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900 dark:border-b-gray-700';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900 dark:border-l-gray-700';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 -mr-1 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900 dark:border-r-gray-700';
      default:
        return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-gray-700';
    }
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {shouldRender && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.9 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 pointer-events-none',
              getPositionStyles()
            )}
            role="tooltip"
            aria-label={content}
          >
            <div
              className={cn(
                'bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap',
                className
              )}
            >
              {content}
              <div className={cn('absolute w-0 h-0 border-4', getArrowStyles())} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
