import React from 'react';

export default function BuboMark({ className = '', size = 40, title = 'Bubo' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <rect x="1" y="1" width="46" height="46" rx="14" fill="rgb(var(--bubo-color-primary) / 0.1)" />
      <path
        d="M11 15.5 17 9l7 4 7-4 6 6.5v13C37 36 31.2 41 24 41S11 36 11 28.5v-13Z"
        fill="rgb(var(--bubo-color-surface))"
        stroke="rgb(var(--bubo-color-primary))"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path
        d="M15 17.5c2.2-2.6 5.7-3.2 9-1.2 3.3-2 6.8-1.4 9 1.2-1.1 6.2-4.2 9.9-9 12.4-4.8-2.5-7.9-6.2-9-12.4Z"
        fill="rgb(var(--bubo-color-primary) / 0.14)"
        stroke="rgb(var(--bubo-color-primary))"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="21" r="4.5" fill="rgb(var(--bubo-color-surface))" stroke="rgb(var(--bubo-color-primary))" strokeWidth="1.75" />
      <circle cx="29" cy="21" r="4.5" fill="rgb(var(--bubo-color-surface))" stroke="rgb(var(--bubo-color-primary))" strokeWidth="1.75" />
      <circle cx="19" cy="21" r="1.8" fill="rgb(var(--bubo-color-text))" />
      <circle cx="29" cy="21" r="1.8" fill="rgb(var(--bubo-color-text))" />
      <path d="m24 23.5-2.5 2.3L24 28l2.5-2.2L24 23.5Z" fill="rgb(var(--bubo-color-primary))" />
      <path d="M17 31.5 24 37l7-5.5" stroke="rgb(var(--bubo-color-primary))" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
