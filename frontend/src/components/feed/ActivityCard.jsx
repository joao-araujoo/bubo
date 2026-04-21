import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Trophy, Star, Plus } from 'lucide-react';

const TYPE_ICONS = {
  review_approved: BookOpen,
  book_completed: Trophy,
  achievement_unlocked: Star,
  book_added: Plus
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityCard({ activity, index }) {
  const Icon = TYPE_ICONS[activity.type] || BookOpen;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-4 p-4 rounded-2xl bg-[#1E1E1E] border border-[#BDBDBD]/10 hover:border-[#8A2BE2]/20 transition-all"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#8A2BE2]/20 flex items-center justify-center">
        {activity.avatar ? (
          <img src={activity.avatar} alt={activity.username} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-[#8A2BE2]">
            {activity.username?.[0]?.toUpperCase() || 'U'}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-white">
            <span className="font-semibold text-[#8A2BE2]">{activity.username}</span>
            {' '}
            <span className="text-[#BDBDBD]">{activity.message}</span>
          </p>
          <span className="text-xs text-[#BDBDBD]/60 flex-shrink-0">{timeAgo(activity.createdAt)}</span>
        </div>

        {activity.cognitiveDepth > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Icon size={12} className="text-[#00FFFF]" />
            <span className="text-xs text-[#00FFFF]">{activity.cognitiveDepth}% Cognitive Depth</span>
            <div className="flex-1 h-1 bg-[#121212] rounded-full overflow-hidden max-w-24">
              <div
                className="h-full bg-[#00FFFF] rounded-full"
                style={{ width: `${activity.cognitiveDepth}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
