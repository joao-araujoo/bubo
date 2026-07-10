import React from 'react';

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export default function Card({
  as: Component = 'section',
  children,
  className = '',
  padding = 'md',
  interactive = false,
  ...props
}) {
  const paddingClass = paddingClasses[padding] ?? paddingClasses.md;

  return (
    <Component
      className={`border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-sm)] rounded-[var(--bubo-radius-lg)] ${
        interactive
          ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--bubo-shadow-md)]'
          : ''
      } ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
