import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  accentColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  src,
  name,
  accentColor = '#4338CA',
  size = 'md',
  className = '',
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Profile avatar'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 border border-[#E7E7E2] bg-[#EFECE6] ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name || 'Profile avatar'}
      style={{ backgroundColor: accentColor }}
      className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-display font-semibold text-white tracking-tight select-none border border-black/10 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
