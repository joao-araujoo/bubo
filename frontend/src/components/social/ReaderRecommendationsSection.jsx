import React from 'react';
import { Network, RefreshCw, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import ReaderRecommendationCard from './ReaderRecommendationCard';
import Button from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import { useSocialStore } from '../../stores/useSocialStore';

export default function ReaderRecommendationsSection({ compact = false }) {
  const {
    fetchReaderRecommendations,
    isLoadingRecommendations,
    recommendationError,
    recommendationMeta,
    recommendations,
    toggleFollow,
    updatingRecommendationIds,
  } = useSocialStore();

  const follow = async (userId) => {
    try {
      await toggleFollow(userId);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const refresh = async () => {
    try {
      await fetchReaderRecommendations({ force: true });
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="reader-recommendations-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">
            <Network size={14} aria-hidden="true" /> Grafo social
          </p>
          <h2 id="reader-recommendations-title" className="mt-1 text-xl font-black sm:text-2xl">Leitores próximos de você</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
            Recomendações explicáveis por caminho na rede, conexões, clubes, livros e interesses em comum.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={refresh}
          disabled={isLoadingRecommendations}
          leftIcon={<RefreshCw size={15} aria-hidden="true" />}
        >
          Recalcular
        </Button>
      </div>

      {isLoadingRecommendations ? (
        <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
          {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
            <Card key={index}>
              <div className="flex gap-3">
                <Skeleton className="h-16 w-16" rounded="full" />
                <div className="flex-1"><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-2 h-4 w-full" /></div>
              </div>
              <Skeleton className="mt-5 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : recommendationError && recommendations.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Não foi possível calcular a proximidade social"
          description={recommendationError}
          actionLabel="Tentar novamente"
          onAction={refresh}
        />
      ) : recommendations.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="A rede ainda precisa de mais conexões"
          description="À medida que leitores seguirem pessoas, entrarem em clubes e adicionarem livros, as recomendações ficarão mais precisas."
        />
      ) : (
        <div className={`flex gap-4 overflow-x-auto pb-2 sm:grid sm:overflow-visible ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
          {recommendations.map((recommendation) => (
            <ReaderRecommendationCard
              key={recommendation.user._id}
              recommendation={recommendation}
              onFollow={follow}
              isUpdating={Boolean(updatingRecommendationIds[recommendation.user._id])}
            />
          ))}
        </div>
      )}

      {recommendationMeta && (
        <p className="text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">
          Método: Dijkstra híbrido · {recommendationMeta.candidatesEvaluated || 0} perfis avaliados · recomendações recalculadas conforme a rede evolui.
        </p>
      )}
    </section>
  );
}
