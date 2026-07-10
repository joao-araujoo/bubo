import React from 'react';

const variantClasses = {
  primary:
    'border-transparent bg-[rgb(var(--bubo-color-primary))] text-[rgb(var(--bubo-color-primary-contrast))] hover:bg-[rgb(var(--bubo-color-primary-hover))]',
  secondary:
    'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text))] hover:bg-[rgb(var(--bubo-color-surface-muted))]',
  ghost:
    'border-transparent bg-transparent text-[rgb(var(--bubo-color-text))] hover:bg-[rgb(var(--bubo-color-surface-muted))]',
  danger:
    'border-transparent bg-[rgb(var(--bubo-color-danger))] text-white hover:opacity-90',
};

const sizeClasses = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export default function Button({
  as: Component = 'button',
  children,
  className = '',
  disabled = false,
  isLoading = false,
  leftIcon,
  onClick,
  rightIcon,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  const variantClass = variantClasses[variant] ?? variantClasses.primary;
  const sizeClass = sizeClasses[size] ?? sizeClasses.md;
  const isDisabled = disabled || isLoading;
  const isNativeButton = Component === 'button';

  const handleClick = (event) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <Component
      {...(isNativeButton ? { type, disabled: isDisabled } : { 'aria-disabled': isDisabled || undefined, tabIndex: isDisabled ? -1 : undefined })}
      aria-busy={isLoading || undefined}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--bubo-radius-md)] border font-semibold shadow-[var(--bubo-shadow-sm)] transition duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${isDisabled && !isNativeButton ? 'pointer-events-none opacity-55' : ''} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </Component>
  );
}
