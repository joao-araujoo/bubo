import React from 'react';
import { motion } from 'framer-motion';

export default function CognitiveDepthMeter({ score = 0, size = 120 }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1E1E1E" strokeWidth="8" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="#00FFFF"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-[#00FFFF]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-[#BDBDBD]">depth</span>
        </div>
      </div>
      <p className="text-xs text-[#BDBDBD] text-center">Cognitive Depth Score</p>
    </div>
  );
}
