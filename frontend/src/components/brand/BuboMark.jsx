import React from 'react';
import BuboBrandAsset from './BuboBrandAsset';

export default function BuboMark({ className = '', size = 40, title = 'Bubo' }) {
  return (
    <BuboBrandAsset
      alt={title}
      className={className}
      size={size}
      variant="mark"
    />
  );
}
