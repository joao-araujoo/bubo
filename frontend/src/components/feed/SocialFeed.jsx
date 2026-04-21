import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import ActivityCard from './ActivityCard';
import api from '../../services/api';

export default function SocialFeed() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.get('/social/feed').then((r) => r.data.activities),
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-[#BDBDBD]">Failed to load feed</p>
        <button onClick={() => refetch()} className="text-[#8A2BE2] text-sm hover:underline flex items-center gap-1 mx-auto">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data?.map((activity, i) => (
        <ActivityCard key={activity._id || i} activity={activity} index={i} />
      ))}
      {(!data || data.length === 0) && (
        <p className="text-center text-[#BDBDBD] py-16">No activity yet. Start reading!</p>
      )}
    </div>
  );
}
