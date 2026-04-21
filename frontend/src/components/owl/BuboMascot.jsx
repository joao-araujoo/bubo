import React from 'react';
import { motion } from 'framer-motion';

export default function BuboMascot({ state = 'idle', size = 120 }) {
  const eyeColor = state === 'approved' ? '#00FFFF' : state === 'guiding' ? '#FF9800' : '#8A2BE2';
  const bodyColor = state === 'approved' ? '#8A2BE2' : state === 'guiding' ? '#7A1BD2' : '#8A2BE2';

  return (
    <motion.div
      animate={state === 'thinking' ? { rotate: [0, -5, 5, -5, 0] } : {}}
      transition={{ duration: 0.8, repeat: state === 'thinking' ? Infinity : 0 }}
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center"
    >
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="60" cy="72" rx="32" ry="36" fill={bodyColor} />
        {/* Wings */}
        <ellipse cx="28" cy="78" rx="16" ry="22" fill={bodyColor} fillOpacity="0.8" transform="rotate(-15 28 78)" />
        <ellipse cx="92" cy="78" rx="16" ry="22" fill={bodyColor} fillOpacity="0.8" transform="rotate(15 92 78)" />
        {/* Head */}
        <circle cx="60" cy="46" r="26" fill="#9D3DFF" />
        {/* Ears (tufts) */}
        <polygon points="45,23 40,10 52,20" fill={bodyColor} />
        <polygon points="75,23 80,10 68,20" fill={bodyColor} />
        {/* Eye whites */}
        <circle cx="50" cy="44" r="11" fill="#1E1E1E" />
        <circle cx="70" cy="44" r="11" fill="#1E1E1E" />
        {/* Eye rings */}
        <circle cx="50" cy="44" r="11" stroke={eyeColor} strokeWidth="2" fill="none" />
        <circle cx="70" cy="44" r="11" stroke={eyeColor} strokeWidth="2" fill="none" />
        {/* Pupils */}
        <motion.circle
          cx="50" cy="44" r="6"
          fill={eyeColor}
          animate={state === 'thinking' ? { scale: [1, 0.7, 1] } : {}}
          transition={{ duration: 1, repeat: state === 'thinking' ? Infinity : 0 }}
        />
        <motion.circle
          cx="70" cy="44" r="6"
          fill={eyeColor}
          animate={state === 'thinking' ? { scale: [1, 0.7, 1] } : {}}
          transition={{ duration: 1, repeat: state === 'thinking' ? Infinity : 0 }}
        />
        {/* Eye shine */}
        <circle cx="53" cy="41" r="2" fill="white" opacity="0.7" />
        <circle cx="73" cy="41" r="2" fill="white" opacity="0.7" />
        {/* Beak */}
        <polygon points="58,52 62,52 60,58" fill="#FF9800" />
        {/* Belly pattern */}
        <ellipse cx="60" cy="80" rx="16" ry="20" fill={bodyColor} fillOpacity="0.5" />
        <ellipse cx="60" cy="82" rx="10" ry="14" fill="white" fillOpacity="0.08" />
        {/* Feet */}
        <ellipse cx="50" cy="106" rx="8" ry="4" fill="#FF9800" fillOpacity="0.8" />
        <ellipse cx="70" cy="106" rx="8" ry="4" fill="#FF9800" fillOpacity="0.8" />
        {/* Smile for approved */}
        {state === 'approved' && (
          <path d="M52 56 Q60 64 68 56" stroke={eyeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        {/* Concerned for guiding */}
        {state === 'guiding' && (
          <>
            <path d="M52 60 Q60 55 68 60" stroke="#FF9800" strokeWidth="2" fill="none" strokeLinecap="round" />
            <line x1="47" y1="36" x2="53" y2="38" stroke="#FF9800" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="73" y1="36" x2="67" y2="38" stroke="#FF9800" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {/* Thinking dots */}
        {state === 'thinking' && (
          <g>
            <motion.circle cx="80" cy="20" r="3" fill={eyeColor} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
            <motion.circle cx="90" cy="14" r="3" fill={eyeColor} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
            <motion.circle cx="100" cy="8" r="3" fill={eyeColor} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.8 }} />
          </g>
        )}
      </svg>
    </motion.div>
  );
}
