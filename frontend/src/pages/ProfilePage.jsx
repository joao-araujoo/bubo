import React, { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Brain, Download, Flame, Gem, LogOut, Medal, Settings, ShieldCheck, Target, Trophy, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton from '../components/ui/Skeleton';
import Textarea from '../components/ui/Textarea';
import { useAchievementStore } from '../stores/useAchievementStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useSocialStore } from '../stores/useSocialStore';
import { formatNumber, formatRelativeTime, getActivityLabel } from '../utils/formatters';

const tabs = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'reviews', label: 'Deep Reviews' },
  { id: 'posts', label: 'Posts' },
  { id: 'badges', label: 'Badges' },
];

const badgeCopy = {
  first_review: { title: 'Primeiro passo', Icon: Medal },
  ten_reviews: { title: 'Mergulho profundo', Icon: Target },
  fifty_reviews: { title: 'Filósofo', Icon: Brain },
  first_book: { title: 'Leitor iniciado', Icon: BookOpen },
  five_books: { title: 'Bibliófilo', Icon: Trophy },
  high_depth: { title: 'Elite cognitiva', Icon: Zap },
  streak_7: { title: 'Semana ativa', Icon: Flame },
  hundred_pages: { title: 'Centenário', Icon: Gem },
};

const rarityLabels = {
  common: 'Comum',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Lendária',
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isLoading: authLoading, logout, refreshProfile, updateProfile, user } = useAuthStore();
  const { clearDashboard, dashboard, fetchDashboard, isLoading: dashboardLoading } = useDashboardStore();
  const { achievements, fetchAchievements, isLoading: achievementsLoading, resetAchievements } = useAchievementStore();
  const { activities, fetchFeed, resetSocial } = useSocialStore();
  const { resetLibrary } = useLibraryStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ username: '', avatar: '', bio: '', readingGoal: 20 });

  useEffect(() => {
    refreshProfile().catch(() => {});
    fetchDashboard().catch(() => {});
    fetchAchievements().catch(() => {});
    fetchFeed().catch(() => {});
  }, [fetchAchievements, fetchDashboard, fetchFeed, refreshProfile]);

  const profile = dashboard?.user || user || {};
  const stats = dashboard?.stats || {
    booksRead: 0,
    reviewsTotal: 0,
    approvedReviews: 0,
    pagesRegistered: 0,
    averageDepth: 0,
    maxDepth: 0,
    xp: 0,
    annualGoal: profile.readingGoal || 20,
  };
  const reviews = dashboard?.recentReviews || [];
  const ownPosts = useMemo(() => activities.filter((activity) => activity.isOwn), [activities]);
  const nextXpLevel = Math.max(2500, Math.ceil((Number(stats.xp) + 1) / 2500) * 2500);
  const name = profile.username || 'Leitor Bubo';

  useEffect(() => {
    setForm({
      username: profile.username || '',
      avatar: profile.avatar || '',
      bio: profile.bio || '',
      readingGoal: profile.readingGoal || 20,
    });
  }, [profile.avatar, profile.bio, profile.readingGoal, profile.username]);

  const updateForm = (field) => (event) => {
    const value = field === 'readingGoal' ? Number(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      await updateProfile(form);
      await fetchDashboard();
      setEditOpen(false);
      toast.success('Perfil atualizado.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleLogout = () => {
    resetLibrary();
    clearDashboard();
    resetAchievements();
    resetSocial();
    logout();
    navigate('/');
  };

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      stats,
      reviews,
      achievements,
      posts: ownPosts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bubo-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dados.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success('Seus dados foram exportados.');
  };

  const profileLoading = dashboardLoading && !dashboard;

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="h-28 bg-[linear-gradient(135deg,rgb(var(--bubo-color-primary)/0.14),rgb(var(--bubo-color-accent)/0.12))] sm:h-36" />
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={name} src={profile.avatar} size="xl" className="border-4 border-[rgb(var(--bubo-color-surface))]" />
              <div className="min-w-0 pb-1">
                {profileLoading ? <Skeleton className="h-8 w-48" /> : <h1 className="truncate text-2xl font-black sm:text-3xl">{name}</h1>}
                <p className="truncate text-sm text-[rgb(var(--bubo-color-text-muted))]">@{String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')} · Explorador</p>
              </div>
            </div>
            <Button variant="secondary" leftIcon={<Settings size={17} />} onClick={() => setEditOpen(true)}>Editar perfil</Button>
          </div>

          <p className="mt-5 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">{profile.bio || 'Lendo para lembrar, escrever melhor e conectar ideias.'}</p>

          <div className="mt-6 grid grid-cols-4 gap-2 border-t border-[rgb(var(--bubo-color-border))] pt-5 text-center">
            <div><strong className="block text-lg">{formatNumber(stats.booksRead)}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Livros lidos</span></div>
            <div><strong className="block text-lg">{formatNumber(stats.reviewsTotal)}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Reviews</span></div>
            <div><strong className="block text-lg">{formatNumber(stats.pagesRegistered)}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Páginas</span></div>
            <div><strong className="block text-lg">{stats.averageDepth || 0}%</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Depth médio</span></div>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Seções do perfil">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition ${activeTab === tab.id ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">DNA de leitura</p>
                <h2 className="mt-1 text-xl font-black">Seu padrão cognitivo</h2>
              </div>
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[7px] border-[rgb(var(--bubo-color-primary))] text-xl font-black text-[rgb(var(--bubo-color-primary))]">{stats.averageDepth || 0}%</div>
            </div>
            <div className="mt-6 space-y-5">
              <ProgressBar label="Meta anual" value={stats.booksRead} max={stats.annualGoal || 20} showValue />
              <ProgressBar label="XP do nível" value={stats.xp} max={nextXpLevel} showValue />
              <ProgressBar label="Validações aprovadas" value={stats.approvedReviews} max={Math.max(stats.reviewsTotal, 1)} showValue />
            </div>
            <p className="mt-5 text-sm text-[rgb(var(--bubo-color-text-muted))]">Maior profundidade registrada: <strong className="text-[rgb(var(--bubo-color-text))]">{stats.maxDepth || 0}%</strong></p>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Brain size={21} /></span>
              <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">IA e dados</p><h2 className="mt-1 text-xl font-black">Configuração do Bubo</h2></div>
            </div>
            <p className="mt-5 text-[rgb(var(--bubo-color-text-muted))]">Status da validação: <strong className="text-[rgb(var(--bubo-color-text))]">disponível</strong></p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" leftIcon={<ShieldCheck size={17} />} onClick={() => toast('As credenciais de IA são protegidas no servidor.')}>Segurança da IA</Button>
              <Button variant="secondary" leftIcon={<Download size={17} />} onClick={exportData}>Exportar dados</Button>
              <Button variant="danger" leftIcon={<LogOut size={17} />} onClick={handleLogout}>Sair</Button>
            </div>
          </Card>
        </section>
      )}

      {activeTab === 'reviews' && (
        profileLoading ? (
          <section className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 w-full" rounded="lg" />)}</section>
        ) : reviews.length === 0 ? (
          <EmptyState icon={Brain} title="Nenhuma Deep Review ainda" description="Faça sua primeira validação para construir seu histórico cognitivo." />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <Card key={review._id}>
                <div className="flex gap-4">
                  <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-lg font-black ${review.status === 'approved' ? 'border-[rgb(var(--bubo-color-primary)/0.25)] bg-[rgb(var(--bubo-color-primary)/0.08)] text-[rgb(var(--bubo-color-primary))]' : 'border-[rgb(var(--bubo-color-warning)/0.35)] bg-[rgb(var(--bubo-color-warning)/0.08)] text-[rgb(var(--bubo-color-warning))]'}`}>{review.cognitiveDepth || 0}</span>
                  <div>
                    <h2 className="font-extrabold">{review.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{review.feedback || review.encouragement || 'A avaliação foi registrada no seu histórico.'}</p>
                    <p className="mt-3 text-xs text-[rgb(var(--bubo-color-text-muted))]">Páginas {review.pageFrom}–{review.pageTo} · {review.status === 'approved' ? 'aprovada' : 'orientação'} · {formatRelativeTime(review.createdAt)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )
      )}

      {activeTab === 'posts' && (
        ownPosts.length === 0 ? (
          <EmptyState title="Você ainda não publicou" description="Compartilhe uma ideia no feed para começar seu histórico social." />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {ownPosts.map((post) => (
              <Card key={post._id}>
                <div className="flex items-center justify-between gap-3"><strong>{getActivityLabel(post.type, post.postType)}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">{formatRelativeTime(post.createdAt)}</span></div>
                <p className="mt-4 leading-7 text-[rgb(var(--bubo-color-text-muted))]">{post.message}</p>
                {post.insight && <div className="mt-4 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 font-bold">{post.insight}</div>}
              </Card>
            ))}
          </section>
        )
      )}

      {activeTab === 'badges' && (
        achievementsLoading ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" rounded="lg" />)}</section>
        ) : achievements.length === 0 ? (
          <EmptyState icon={Award} title="Nenhum badge disponível" description="As conquistas aparecerão conforme seu progresso for sincronizado." />
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => {
              const localized = badgeCopy[achievement.id] || { title: achievement.name, Icon: Award };
              const Icon = localized.Icon;
              return (
                <Card key={achievement.id} className={!achievement.unlocked ? 'opacity-65' : ''}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={22} /></span>
                    <div><h2 className="font-extrabold">{localized.title}</h2><p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{achievement.unlocked ? `Desbloqueada · ${rarityLabels[achievement.rarity] || achievement.rarity}` : `${achievement.progress}% concluída`}</p></div>
                  </div>
                </Card>
              );
            })}
          </section>
        )
      )}

      <Modal
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        title="Editar perfil"
        description="Atualize como você aparece no Bubo e defina sua meta anual."
        footer={(
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="submit" form="profile-form" isLoading={authLoading}>Salvar alterações</Button>
          </div>
        )}
      >
        <form id="profile-form" className="space-y-4" onSubmit={saveProfile}>
          <Input label="Nome de usuário" value={form.username} onChange={updateForm('username')} minLength={3} maxLength={30} required />
          <Input label="URL do avatar" type="url" value={form.avatar} onChange={updateForm('avatar')} placeholder="https://…" description="Deixe vazio para usar suas iniciais." />
          <Textarea label="Biografia" value={form.bio} onChange={updateForm('bio')} rows={4} maxLength={240} description={`${form.bio.length}/240 caracteres`} />
          <Input label="Meta anual de livros" type="number" value={form.readingGoal} onChange={updateForm('readingGoal')} min={1} max={365} required />
        </form>
      </Modal>
    </div>
  );
}
