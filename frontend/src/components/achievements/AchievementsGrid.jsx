import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import AchievementBadge from './AchievementBadge';
import api from '../../services/api';

const FALLBACK_ACHIEVEMENTS = [
  { id: 'first_review', name: 'First Steps', description: 'Complete your first Deep Review', icon: '🦉', unlocked: false },
  { id: 'ten_reviews', name: 'Deep Diver', description: 'Complete 10 Deep Reviews', icon: '🎯', unlocked: false },
  { id: 'fifty_reviews', name: 'Philosopher', description: 'Complete 50 Deep Reviews', icon: '🧠', unlocked: false },
  { id: 'first_book', name: 'Bookworm', description: 'Finish your first book', icon: '📚', unlocked: false },
  { id: 'five_books', name: 'Bibliophile', description: 'Finish 5 books', icon: '🏛️', unlocked: false },
  { id: 'high_depth', name: 'Cognitive Elite', description: 'Achieve 90%+ Cognitive Depth score', icon: '⚡', unlocked: false },
  { id: 'streak_7', name: 'Consistent Reader', description: '7-day reading streak', icon: '🔥', unlocked: false },
  { id: 'hundred_pages', name: 'Century', description: 'Read 100 pages total', icon: '💯', unlocked: false }
];

export default function AchievementsGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get('/achievements').then((r) => r.data.achievements),
    onError: () => {}
  });

  const achievements = data || FALLBACK_ACHIEVEMENTS;
  const unlocked = achievements.filter((a) => a.unlocked).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[#BDBDBD]">
        {unlocked} / {achievements.length} unlocked
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {achievements.map((ach, i) => (
          <AchievementBadge key={ach.id} achievement={ach} index={i} />
        ))}
      </div>
    </div>
  );
}
