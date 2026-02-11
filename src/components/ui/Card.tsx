import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', onClick, padding = 'md' }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-gray-900 rounded-xl border border-gray-800
        ${paddingStyles[padding]}
        ${onClick ? 'active:bg-gray-800 cursor-pointer transition-colors' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
