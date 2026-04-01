import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl", className)}>
    {children}
  </div>
);

export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  loading = false,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20",
    secondary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
    outline: "border border-white/20 hover:bg-white/5 text-white",
    ghost: "hover:bg-white/5 text-white/70 hover:text-white",
    danger: "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
  };

  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
    >
      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : children}
    </button>
  );
};

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-white/10 rounded-md", className)} />
);
