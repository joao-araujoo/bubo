import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

export default function AchievementBadge({ achievement, index }) {
  const { name, description, icon, unlocked } = achievement;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={`p-5 rounded-2xl border transition-all duration-300 ${
        unlocked
          ? 'bg-[#1E1E1E] border-[#8A2BE2]/40 glow-purple'
          : 'bg-[#1E1E1E] border-[#BDBDBD]/10 opacity-60'
      }`}
    >
      <div className="flex flex-col items-center text-center gap-3">
        <div className={`text-4xl transition-all ${unlocked ? '' : 'grayscale opacity-50'}`}>
          {unlocked ? icon : <Lock size={32} className="text-[#BDBDBD]/40" />}
        </div>
        <div>
          <p className={`font-semibold text-sm ${unlocked ? 'text-white' : 'text-[#BDBDBD]'}`}>{name}</p>
          <p className="text-xs text-[#BDBDBD] mt-1 leading-relaxed">{description}</p>
        </div>
        {unlocked && (
          <span className="text-xs bg-[#8A2BE2]/20 text-[#8A2BE2] px-2 py-0.5 rounded-full">Unlocked</span>
        )}
      </div>
    </motion.div>
  );
}
