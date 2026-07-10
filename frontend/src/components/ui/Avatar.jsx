import React from 'react';

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export default function Avatar({
  alt = '',
  className = '',
  name = 'Usuário',
  size = 'md',
  src,
}) {
  const sizeClass = sizeClasses[size] ?? sizeClasses.md;
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={`shrink-0 rounded-full border border-[rgb(var(--bubo-color-border))] object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[rgb(var(--bubo-color-primary)/0.25)] bg-[rgb(var(--bubo-color-primary)/0.12)] font-bold text-[rgb(var(--bubo-color-primary))] ${sizeClass} ${className}`}
      aria-label={name}
      title={name}
    >
      {initials || 'U'}
    </span>
  );
}
