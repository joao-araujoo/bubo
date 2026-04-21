import React from 'react';

const STATUS_CONFIG = {
  reading: { label: 'Reading', color: 'bg-[#00FFFF]/20 text-[#00FFFF] border-[#00FFFF]/30' },
  'to-read': { label: 'To Read', color: 'bg-[#8A2BE2]/20 text-[#8A2BE2] border-[#8A2BE2]/30' },
  read: { label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  abandoned: { label: 'Abandoned', color: 'bg-[#BDBDBD]/20 text-[#BDBDBD] border-[#BDBDBD]/30' }
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['to-read'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}
