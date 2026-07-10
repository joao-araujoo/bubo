import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

const toneClasses = [
  'from-violet-700 to-fuchsia-500',
  'from-amber-600 to-orange-400',
  'from-slate-700 to-slate-500',
  'from-emerald-700 to-teal-400',
];

function getTone(title) {
  const sum = String(title || '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return toneClasses[sum % toneClasses.length];
}

export default function BookCover({
  alt,
  author,
  className = '',
  src,
  title = 'Livro sem título',
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt || `Capa de ${title}`}
        className={`aspect-[2/3] w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] object-cover shadow-[var(--bubo-shadow-md)] ${className}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-[var(--bubo-radius-md)] border border-white/15 bg-gradient-to-br ${getTone(title)} p-3 text-white shadow-[var(--bubo-shadow-md)] ${className}`}
      role="img"
      aria-label={`Capa indisponível de ${title}`}
    >
      <BookOpen size={20} aria-hidden="true" />
      <div>
        <strong className="block text-sm font-extrabold leading-tight">{title}</strong>
        {author && <span className="mt-1 block text-[0.68rem] text-white/75">{author}</span>}
      </div>
    </div>
  );
}
