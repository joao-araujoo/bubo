import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Crown,
  Globe2,
  Lock,
  LogOut,
  MessageSquare,
  Send,
  Shield,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Avatar from '../components/ui/Avatar';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton from '../components/ui/Skeleton';
import Textarea from '../components/ui/Textarea';
import { useClubStore } from '../stores/useClubStore';
import { formatRelativeTime } from '../utils/formatters';

const roleLabels = {
  owner: 'Owner',
  moderator: 'Moderador',
  member: 'Membro',
};

function formatDate(value) {
  if (!value) return 'Sem prazo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function ClubDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    activeClub,
    clearActiveClub,
    createDiscussion,
    error,
    fetchClub,
    isLoading,
    isMutating,
    joinClub,
    leaveClub,
    updateProgress,
  } = useClubStore();
  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') || '');
  const [progress, setProgress] = useState(0);
  const [discussion, setDiscussion] = useState({ body: '', insight: '', pageFrom: '', pageTo: '' });

  useEffect(() => {
    let active = true;

    const loadClub = async () => {
      try {
        if (searchParams.get('invite')) {
          await joinClub(id, searchParams.get('invite'));
        }
        const club = await fetchClub(id);
        if (active) setProgress(club.membership?.currentPage || 0);
      } catch {
        // A interface abaixo mostra o estado de erro e o formulário de convite.
      }
    };

    loadClub();
    return () => {
      active = false;
      clearActiveClub();
    };
  }, [clearActiveClub, fetchClub, id, joinClub, searchParams]);

  useEffect(() => {
    if (activeClub?.membership) setProgress(activeClub.membership.currentPage || 0);
  }, [activeClub?.membership]);

  const orderedMembers = useMemo(() => {
    const roleOrder = { owner: 0, moderator: 1, member: 2 };
    return [...(activeClub?.members || [])].sort((a, b) => {
      const roleDifference = roleOrder[a.role] - roleOrder[b.role];
      if (roleDifference !== 0) return roleDifference;
      return String(a.user?.username || '').localeCompare(String(b.user?.username || ''));
    });
  }, [activeClub?.members]);

  const handleJoin = async () => {
    try {
      await joinClub(id, inviteCode);
      const club = await fetchClub(id);
      setProgress(club.membership?.currentPage || 0);
      toast.success(`Você entrou em “${club.name}”.`);
    } catch (joinError) {
      toast.error(joinError.message);
    }
  };

  const saveProgress = async (event) => {
    event.preventDefault();
    try {
      await updateProgress(id, Number(progress));
      await fetchClub(id);
      toast.success('Seu progresso foi atualizado para o grupo.');
    } catch (progressError) {
      toast.error(progressError.message);
    }
  };

  const publishDiscussion = async (event) => {
    event.preventDefault();
    try {
      await createDiscussion(id, discussion);
      setDiscussion({ body: '', insight: '', pageFrom: '', pageTo: '' });
      toast.success('Sua contribuição foi publicada no clube.');
    } catch (discussionError) {
      toast.error(discussionError.message);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Sair deste clube de leitura?')) return;
    try {
      await leaveClub(id);
      toast.success('Você saiu do clube.');
      navigate('/clubs');
    } catch (leaveError) {
      toast.error(leaveError.message);
    }
  };

  const copyInvite = async () => {
    const inviteUrl = `${window.location.origin}/clubs/${id}?invite=${activeClub.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Link de convite copiado.');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  if (isLoading && !activeClub) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-72 w-full" rounded="lg" />
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <Skeleton className="h-[32rem] w-full" rounded="lg" />
          <Skeleton className="h-[26rem] w-full" rounded="lg" />
        </div>
      </div>
    );
  }

  if (!activeClub) {
    const isPrivateError = String(error || '').toLowerCase().includes('private');
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Button as={Link} to="/clubs" variant="ghost" leftIcon={<ArrowLeft size={17} />}>Voltar aos clubes</Button>
        <Card padding="lg">
          <EmptyState
            icon={isPrivateError ? Lock : Users}
            title={isPrivateError ? 'Clube privado' : 'Clube indisponível'}
            description={isPrivateError ? 'Digite o código recebido de um membro responsável para entrar.' : (error || 'Este clube não pôde ser encontrado.')}
          />
          {isPrivateError && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="Código de convite" maxLength={12} aria-label="Código de convite" />
              <Button onClick={handleJoin} isLoading={isMutating} disabled={inviteCode.length < 6}>Entrar</Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const book = activeClub.book || {};
  const membership = activeClub.membership;
  const isOwner = membership?.role === 'owner';
  const canShareInvite = activeClub.visibility === 'private' && ['owner', 'moderator'].includes(membership?.role);
  const totalPages = Number(book.totalPages) || Math.max(Number(progress) || 0, 1);
  const VisibilityIcon = activeClub.visibility === 'private' ? Lock : Globe2;

  return (
    <div className="space-y-6">
      <Button as={Link} to="/clubs" variant="ghost" leftIcon={<ArrowLeft size={17} />}>Voltar aos clubes</Button>

      <Card padding="lg" className="overflow-hidden">
        <div className="grid gap-6 md:grid-cols-[10rem_1fr] lg:grid-cols-[12rem_1fr]">
          <BookCover title={book.title || 'Livro do clube'} author={book.author} src={book.coverImage} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--bubo-color-surface-muted))] px-3 py-1.5 text-xs font-bold text-[rgb(var(--bubo-color-text-muted))]">
                <VisibilityIcon size={14} /> {activeClub.visibility === 'private' ? 'Clube privado' : 'Clube público'}
              </span>
              {membership?.role && <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">{roleLabels[membership.role]}</span>}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{activeClub.name}</h1>
            <p className="mt-2 text-sm font-semibold text-[rgb(var(--bubo-color-primary))]">{book.title || 'Livro não informado'} · {book.author || 'Autor não informado'}</p>
            <p className="mt-4 max-w-3xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">{activeClub.description || 'Uma leitura coletiva para avançar com atenção, contexto e boas conversas.'}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3"><Users size={18} className="text-[rgb(var(--bubo-color-primary))]" /><strong className="mt-2 block text-lg">{activeClub.stats?.memberCount || 0}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">membros</span></div>
              <div className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3"><MessageSquare size={18} className="text-[rgb(var(--bubo-color-primary))]" /><strong className="mt-2 block text-lg">{activeClub.stats?.discussionsCount || 0}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">discussões</span></div>
              <div className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3"><CalendarDays size={18} className="text-[rgb(var(--bubo-color-primary))]" /><strong className="mt-2 block text-sm">{formatDate(activeClub.targetDate)}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">meta do grupo</span></div>
            </div>
          </div>
        </div>
      </Card>

      {!membership ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black">Participe desta leitura</h2><p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">Entre para registrar progresso e conversar com o grupo.</p></div>
            <Button onClick={handleJoin} isLoading={isMutating}>Entrar no clube</Button>
          </div>
        </Card>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1fr_21rem]">
          <div className="space-y-6">
            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">Leitura coletiva</p><h2 className="mt-1 text-xl font-black">Progresso do clube</h2></div>
                <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">Média {activeClub.stats?.progressPercentage || 0}%</span>
              </div>
              <ProgressBar className="mt-5" label="Média do grupo" value={activeClub.stats?.averagePage || 0} max={totalPages} showValue />
              <form className="mt-6 flex flex-col gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 sm:flex-row sm:items-end" onSubmit={saveProgress}>
                <Input label="Minha página atual" type="number" value={progress} onChange={(event) => setProgress(event.target.value)} min={0} max={book.totalPages || undefined} required />
                <Button type="submit" isLoading={isMutating}>Atualizar progresso</Button>
              </form>
            </Card>

            <Card>
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">Discussão contextual</p><h2 className="mt-1 text-xl font-black">Compartilhe o que ficou</h2><p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Indique páginas quando a ideia puder revelar acontecimentos do livro.</p></div>
              <form className="mt-5 space-y-4" onSubmit={publishDiscussion}>
                <Textarea value={discussion.body} onChange={(event) => setDiscussion((current) => ({ ...current, body: event.target.value }))} label="Contribuição" rows={5} maxLength={2000} required placeholder="Que relação, pergunta ou interpretação merece ser discutida?" description={`${discussion.body.length}/2000 caracteres`} />
                <Input value={discussion.insight} onChange={(event) => setDiscussion((current) => ({ ...current, insight: event.target.value }))} label="Insight principal" maxLength={500} placeholder="Resuma a ideia em uma frase" />
                <div className="grid gap-4 sm:grid-cols-2"><Input value={discussion.pageFrom} onChange={(event) => setDiscussion((current) => ({ ...current, pageFrom: event.target.value }))} label="Página inicial" type="number" min={0} max={book.totalPages || undefined} /><Input value={discussion.pageTo} onChange={(event) => setDiscussion((current) => ({ ...current, pageTo: event.target.value }))} label="Página final" type="number" min={0} max={book.totalPages || undefined} /></div>
                <Button type="submit" leftIcon={<Send size={17} />} isLoading={isMutating} disabled={!discussion.body.trim()}>Publicar no clube</Button>
              </form>
            </Card>

            <section className="space-y-4">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">Conversa do grupo</p><h2 className="mt-1 text-2xl font-black">Discussões recentes</h2></div>
              {(activeClub.discussions || []).length === 0 ? (
                <EmptyState icon={MessageSquare} title="A conversa ainda não começou" description="Publique a primeira pergunta ou conexão desta leitura." />
              ) : (
                activeClub.discussions.map((item) => (
                  <Card key={item._id} as="article">
                    <div className="flex items-start gap-3"><Avatar name={item.user?.username || 'Leitor Bubo'} src={item.user?.avatar} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.user?.username || 'Leitor Bubo'}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">{formatRelativeTime(item.createdAt)}</span></div>{(item.pageFrom !== undefined || item.pageTo !== undefined) && <span className="mt-1 block text-xs font-semibold text-[rgb(var(--bubo-color-primary))]">Páginas {item.pageFrom ?? '?'}–{item.pageTo ?? item.pageFrom ?? '?'}</span>}</div></div>
                    <p className="mt-4 whitespace-pre-line leading-7 text-[rgb(var(--bubo-color-text-muted))]">{item.body}</p>
                    {item.insight && <div className="mt-4 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4"><span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Insight</span><p className="mt-2 font-bold leading-6">{item.insight}</p></div>}
                  </Card>
                ))
              )}
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <Card>
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">Membros</h2><span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{orderedMembers.length}/{activeClub.memberLimit}</span></div>
              <div className="mt-4 space-y-3">
                {orderedMembers.map((member) => {
                  const RoleIcon = member.role === 'owner' ? Crown : member.role === 'moderator' ? Shield : Users;
                  return <div key={member._id} className="flex items-center gap-3"><Avatar name={member.user?.username || 'Leitor Bubo'} src={member.user?.avatar} size="sm" /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{member.user?.username || 'Leitor Bubo'}{member.isCurrentUser ? ' · você' : ''}</strong><span className="flex items-center gap-1 text-xs text-[rgb(var(--bubo-color-text-muted))]"><RoleIcon size={12} /> {roleLabels[member.role]} · pág. {member.currentPage || 0}</span></div></div>;
                })}
              </div>
            </Card>

            {canShareInvite && (
              <Card>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Convite privado</p>
                <strong className="mt-2 block font-mono text-2xl tracking-[0.16em]">{activeClub.inviteCode}</strong>
                <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Compartilhe o link apenas com quem deverá participar.</p>
                <Button className="mt-4 w-full" variant="secondary" leftIcon={<Copy size={16} />} onClick={copyInvite}>Copiar convite</Button>
              </Card>
            )}

            {!isOwner && (
              <Button className="w-full" variant="danger" leftIcon={<LogOut size={17} />} onClick={handleLeave} isLoading={isMutating}>Sair do clube</Button>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}
