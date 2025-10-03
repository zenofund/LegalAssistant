import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface DynamicLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

export function DynamicLogo({ className = '', alt = 'easyAI Logo', ...props }: DynamicLogoProps) {
  const { theme } = useTheme();
  
  const logoSrc = theme === 'dark' ? '/2.png' : '/1.png';
  
  return (
    <img
      src={logoSrc}
      alt={alt}
      className={className}
      {...props}
    />
  );
}