import React, { Children, cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

const getOptionLabel = (children) => {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  return Children.toArray(children).join('');
};

export default function Select({
  children,
  className = '',
  defaultValue = '',
  description,
  disabled = false,
  error,
  id,
  label,
  name,
  onBlur,
  onChange,
  required = false,
  value,
  ...buttonProps
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const listboxId = `${selectId}-listbox`;
  const descriptionId = description ? `${selectId}-description` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(() => Children.toArray(children)
    .filter(isValidElement)
    .map((option) => ({
      value: String(option.props.value ?? ''),
      label: getOptionLabel(option.props.children),
      disabled: Boolean(option.props.disabled),
      element: option,
    })), [children]);

  const selectedValue = value !== undefined ? String(value) : String(uncontrolledValue ?? '');
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));
  const selectedOption = options.find((option) => option.value === selectedValue) || options[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    setActiveIndex(selectedIndex);

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, selectedIndex]);

  const emitChange = (nextValue) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.({
      target: { value: nextValue, name },
      currentTarget: { value: nextValue, name },
    });
  };

  const selectOption = (option) => {
    if (!option || option.disabled) return;
    emitChange(option.value);
    setIsOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const moveActive = (direction) => {
    if (!options.length) return;
    let next = activeIndex;
    do {
      next = (next + direction + options.length) % options.length;
    } while (options[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      else moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      else moveActive(-1);
    } else if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      setActiveIndex(options.findIndex((option) => !option.disabled));
    } else if (event.key === 'End' && isOpen) {
      event.preventDefault();
      const reversedIndex = [...options].reverse().findIndex((option) => !option.disabled);
      setActiveIndex(reversedIndex < 0 ? 0 : options.length - 1 - reversedIndex);
    } else if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      selectOption(options[activeIndex]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <div className="w-full" ref={rootRef}>
      {label && (
        <label htmlFor={selectId} className="mb-2 block text-sm font-semibold text-[rgb(var(--bubo-color-text))]">
          {label}
          {required && <span className="ml-1 text-[rgb(var(--bubo-color-danger))]" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={buttonRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required}
          disabled={disabled}
          onBlur={onBlur}
          onClick={() => setIsOpen((current) => !current)}
          onKeyDown={handleKeyDown}
          className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--bubo-radius-md)] border bg-[rgb(var(--bubo-color-surface))] px-3.5 text-left text-[rgb(var(--bubo-color-text))] shadow-[var(--bubo-shadow-sm)] transition focus:border-[rgb(var(--bubo-color-primary))] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--bubo-color-primary)/0.1)] disabled:cursor-not-allowed disabled:bg-[rgb(var(--bubo-color-surface-muted))] disabled:opacity-70 ${error ? 'border-[rgb(var(--bubo-color-danger))]' : 'border-[rgb(var(--bubo-color-border))]'} ${className}`}
          {...buttonProps}
        >
          <span className={`min-w-0 truncate ${selectedOption?.value ? '' : 'text-[rgb(var(--bubo-color-text-muted))]'}`}>
            {selectedOption?.label || 'Selecione uma opção'}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-[rgb(var(--bubo-color-text-muted))] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {name && <input type="hidden" name={name} value={selectedValue} />}

        {isOpen && (
          <>
            <button
              type="button"
              aria-label="Fechar opções"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[80] bg-slate-950/25 backdrop-blur-[1px] sm:hidden"
            />
            <div
              id={listboxId}
              role="listbox"
              aria-activedescendant={`${selectId}-option-${activeIndex}`}
              className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] max-h-[62vh] overflow-hidden rounded-[1.25rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-2 shadow-[var(--bubo-shadow-lg)] sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-[calc(100%+0.5rem)] sm:z-50 sm:max-h-80 sm:rounded-[var(--bubo-radius-lg)]"
            >
              <div className="flex items-center justify-between border-b border-[rgb(var(--bubo-color-border))] px-2 pb-2 sm:hidden">
                <span className="text-sm font-extrabold">{label || 'Escolha uma opção'}</span>
                <button type="button" onClick={() => setIsOpen(false)} className="grid h-10 w-10 place-items-center rounded-full text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))]" aria-label="Fechar lista">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="max-h-[calc(62vh-3.5rem)] overflow-y-auto overscroll-contain py-1 sm:max-h-72">
                {options.map((option, index) => {
                  const isSelected = option.value === selectedValue;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={`${option.value}-${index}`}
                      id={`${selectId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--bubo-radius-md)] px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${isActive ? 'bg-[rgb(var(--bubo-color-primary)/0.09)]' : 'hover:bg-[rgb(var(--bubo-color-surface-muted))]'} ${isSelected ? 'text-[rgb(var(--bubo-color-primary))]' : 'text-[rgb(var(--bubo-color-text))]'}`}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check size={17} className="shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {description && !error && <p id={descriptionId} className="mt-1.5 text-sm text-[rgb(var(--bubo-color-text-muted))]">{description}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-[rgb(var(--bubo-color-danger))]" role="alert">{error}</p>}

      <span className="sr-only" aria-hidden="true">
        {options.map((option) => cloneElement(option.element, { key: option.value }))}
      </span>
    </div>
  );
}
