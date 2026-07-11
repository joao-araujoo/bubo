import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
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
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton from '../components/ui/Skeleton';
import Textarea from '../components/ui/Textarea';
import { useClubStore } from '../stores/useClubStore';
import { formatRelativeTime } from '../utils/formatters';
import { validateClubDiscussion } from '../utils/clubDiscussion';

const roleLabels = {
  owner: 'Criador',
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
    errorCode,
    fetchClub,
    isLoading,
    isMutating,
    joinClub,
    leaveClub,
    updateProgress,
  } = useClubStore();
  const inviteFromUrl = searchParams.get('invite') || '';
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [inviteFailure, setInviteFailure] = useState('');
  const [progress, setProgress] = useState(0);
  const [discussion, setDiscussion] = useState({ body: '', insight: '', pageFrom: '', pageTo: '' });
  const [discussionError, setDiscussionError] = useState('');
  const [isLeaveOpen, setLeaveOpen] = useState(false);
  const [isInviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const loadClub = async () => {
      if (inviteFromUrl) {
        try {
          await joinClub(id, inviteFromUrl);
        } catch (joinError) {
          if (active) setInviteFailure(joinError.message);
        }
      }

      try {
        const club = await fetchClub(id);
        if (active) setProgress(club.membership?.currentPage || 0);
      } catch {
        // O estado de recuperação é renderizado a partir do código da API.
      }
    };

    loadClub();
    return () => {
      active = false;
      clearActiveClub();
    };
  }, [clearActiveClub, fetchClub, id, inviteFromUrl, joinClub]);

  useEffect(() => {
    if (activeClub?.membership) setProgress(activeClub.membership.currentPage || 0);
  }, [activeClub?.membership]);

  const orderedMembers = useMemo(() => {
    const roleOrder = { owner: 0, moderator: 1, member: 2 };
    return [...(activeClub?.members || [])].sort((a, b) => {
      const roleDifference = roleOrder[a.role] - roleOrder[b.role];
      if (roleDifference !== 0) return roleDifference;
      return String(a.user?.username || '').localeCompare(String(b.user?.username || ''), 'pt-BR');
    });
  }, [activeClub?.members]);

  const handleJoin = async () => {
    setInviteFailure('');
    try {
      await joinClub(id, inviteCode);
      const club = await fetchClub(id);
      setProgress(club.membership?.currentPage || 0);
      toast.success(`Você entrou em “${club.name}”.`);
    } catch (joinError) {
      setInviteFailure(joinError.message);
      toast.error(joinError.message);
    }
  };

  const retryClub = async () => {
    try {
      const club = await fetchClub(id);
      setProgress(club.membership?.currentPage || 0);
    } catch {
      // O store preserva o erro mais recente para a interface.
    }
  };

  const saveProgress = async (event) => {
    event.preventDefault();
    const nextPage = Number.parseInt(progress, 10);
    const totalPages = Number(activeClub?.book?.totalPages) || 0;
    if (!Number.isInteger(nextPage) || nextPage < 0) {
      toast.error('Informe uma página atual válida.');
      return;
    }
    if (totalPages > 0 && nextPage > totalPages) {
      toast.error(`A página atual não pode ultrapassar ${totalPages}.`);
      return;
    }

    try {
      const club = await updateProgress(id, nextPage);
      setProgress(club.membership?.currentPage || nextPage);
      toast.success('Seu progresso foi atualizado para o grupo.');
    } catch (progressError) {
      toast.error(progressError.message);
    }
  };

  const publishDiscussion = async (event) => {
    event.preventDefault();
    const validationError = validateClubDiscussion(discussion, activeClub?.book?.totalPages);
    setDiscussionError(validationError || '');
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await createDiscussion(id, discussion);
      setDiscussion({ body: '', insight: '', pageFrom: '', pageTo: '' });
      setDiscussionError('');
      toast.success('Sua contribuição foi publicada no clube.');
    } catch (publishError) {
      setDiscussionError(publishError.message);
      toast.error(publishError.message);
    }
  };

  const focusDiscussion = () => {
    document.getElementById('club-discussion-body')?.focus();
    document.getElementById('club-discussion-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const confirmLeave = async () => {
    try {
      await leaveClub(id);
      toast.success('Você saiu do clube.');
      setLeaveOpen(false);
      navigate('/clubs');
    } catch (leaveError) {
      toast.error(leaveError.message);
    }
  };

  const inviteUrl = activeClub?.inviteCode
    ? `${window.location.origin}/clubs/${id}?invite=${activeClub.inviteCode}`
    : '';

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Link de convite copiado.');
    } catch {
      document.getElementById('club-invite-url')?.select();
      toast.error('A cópia automática falhou. O link foi selecionado para você copiar.');
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
    const isPrivateError = errorCode === 'CLUB_PRIVATE' || errorCode === 'CLUB_INVITE_INVALID';
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Button as={Link} to="/clubs" variant="ghost" leftIcon={<ArrowLeft size={17} aria-hidden="true" />}>Voltar aos clubes</Button>
        <Card padding="lg">
          <EmptyState
            icon={isPrivateError ? Lock : Users}
            title={isPrivateError ? 'Clube privado' : 'Clube indisponível'}
            description={isPrivateError ? 'Digite o código recebido de um responsável pelo clube para entrar.' : (error || 'Este clube não pôde ser encontrado.')}
            actionLabel={!isPrivateError ? 'Tentar novamente' : undefined}
            onAction={!isPrivateError ? retryClub : undefined}
            secondaryActionLabel={!isPrivateError ? 'Ver outros clubes' : undefined}
            onSecondaryAction={!isPrivateError ? () => navigate('/clubs') : undefined}
          />
          {isPrivateError && (
            <div className="mt-5 space-y-3">
              <Input
                value={inviteCode}
                onChange={(event) => {
                  setInviteCode(event.target.value.toUpperCase());
                  setInviteFailure('');
                }}
                placeholder="Código de convite"
                maxLength={12}
                label="Código de convite"
                error={inviteFailure}
              />
              <Button className="w-full" onClick={handleJoin} isLoading={isMutating} disabled={inviteCode.length < 6}>Entrar no clube</Button>
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
  const libraryEntry = activeClub.libraryEntry;

  return (
    <div className="space-y-6">
      <Button as={Link} to="/clubs" variant="ghost" leftIcon={<ArrowLeft size={17} aria-hidden="true" />}>Voltar aos clubes</Button>

      <Card padding="lg" className="overflow-hidden">
        <div className="grid gap-6 md:grid-cols-[10rem_1fr] lg:grid-cols-[12rem_1fr]">
          <div className="mx-auto w-40 md:mx-0 md:w-auto">
            <BookCover title={book.title || 'Livro do clube'} author={book.author} src={book.coverImage} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--bubo-color-surface-muted))] px-3 py-1.5 text-xs font-bold text-[rgb(var(--bubo-color-text-muted))]">
                <VisibilityIcon size={14} aria-hidden="true" /> {activeClub.visibility === 'private' ? 'Clube privado' : 'Clube público'}
              </span>
              {membership?.role && <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">{roleLabels[membership.role]}</span>}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{activeClub.name}</h1>
            <p className="mt-2 text-sm font-semibold text-[rgb(var(--bubo-color-primary))]">{book.title || 'Livro não informado'} · {book.author || 'Autor não informado'}</p>
            <p className="mt-4 max-w-3xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">{activeClub.description || 'Uma leitura coletiva para avançar com atenção, contexto e boas conversas.'}</p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {libraryEntry ? (
                <Button as={Link} to={`/library/${libraryEntry._id}`} variant="secondary" leftIcon={<BookOpen size={17} aria-hidden="true" />} rightIcon={<ArrowRight size={16} aria-hidden="true" />}>Abrir minha leitura</Button>
              ) : (
                <Button as={Link} to="/discover" variant="secondary" leftIcon={<BookOpen size={17} aria-hidden="true" />}>Adicionar ao acervo</Button>
              )}
              {canShareInvite && <Button variant="ghost" onClick={() => setInviteOpen(true)} leftIcon={<Copy size={16} aria-hidden="true" />}>Compartilhar convite</Button>}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ClubMetric icon={Users} value={activeClub.stats?.memberCount || 0} label="membros" />
              <ClubMetric icon={MessageSquare} value={activeClub.stats?.discussionsCount || 0} label="discussões" />
              <ClubMetric icon={CalendarDays} value={formatDate(activeClub.targetDate)} label="meta do grupo" className="col-span-2 sm:col-span-1" small />
            </div>
          </div>
        </div>
      </Card>

      {!membership ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black">Participe desta leitura</h2><p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">Entre para registrar progresso e conversar com o grupo.</p></div>
            <Button className="w-full sm:w-auto" onClick={handleJoin} isLoading={isMutating}>Entrar no clube</Button>
          </div>
        </Card>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">Leitura coletiva</p><h2 className="mt-1 text-xl font-black">Progresso do clube</h2></div>
                <span className="self-start rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">Média {activeClub.stats?.progressPercentage || 0}%</span>
              </div>
              <ProgressBar className="mt-5" label="Média do grupo" value={activeClub.stats?.averagePage || 0} max={totalPages} showValue />
              <form className="mt-6 flex flex-col gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 sm:flex-row sm:items-end" onSubmit={saveProgress}>
                <Input label="Minha página atual" type="number" value={progress} onChange={(event) => setProgress(event.target.value)} min={0} max={book.totalPages || undefined} required />
                <Button className="w-full sm:w-auto" type="submit" isLoading={isMutating}>Atualizar progresso</Button>
              </form>
            </Card>

            <Card>
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">Discussão contextual</p><h2 className="mt-1 text-xl font-black">Compartilhe o que ficou</h2><p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Indique um intervalo completo quando a ideia puder revelar acontecimentos do livro.</p></div>
              <form id="club-discussion-form" className="mt-5 scroll-mt-24 space-y-4" onSubmit={publishDiscussion}>
                <Textarea
                  id="club-discussion-body"
                  value={discussion.body}
                  onChange={(event) => {
                    setDiscussion((current) => ({ ...current, body: event.target.value }));
                    setDiscussionError('');
                  }}
                  label="Contribuição"
                  rows={7}
                  maxLength={2000}
                  required
                  error={discussionError}
                  placeholder="Que relação, pergunta ou interpretação merece ser discutida?"
                  description={`${discussion.body.length}/2000 caracteres`}
                />
                <Input value={discussion.insight} onChange={(event) => setDiscussion((current) => ({ ...current, insight: event.target.value }))} label="Insight principal" maxLength={500} placeholder="Resuma a ideia em uma frase" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input value={discussion.pageFrom} onChange={(event) => { setDiscussion((current) => ({ ...current, pageFrom: event.target.value })); setDiscussionError(''); }} label="Página inicial" type="number" min={1} max={book.totalPages || undefined} description="Preencha as duas páginas ou deixe ambas vazias." />
                  <Input value={discussion.pageTo} onChange={(event) => { setDiscussion((current) => ({ ...current, pageTo: event.target.value })); setDiscussionError(''); }} label="Página final" type="number" min={Number(discussion.pageFrom) || 1} max={book.totalPages || undefined} />
                </div>
                <div className="flex justify-end">
                  <Button className="w-full sm:w-auto" type="submit" leftIcon={<Send size={17} aria-hidden="true" />} isLoading={isMutating} disabled={!discussion.body.trim()}>Publicar no clube</Button>
                </div>
              </form>
            </Card>

            <section className="space-y-4">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]">Conversa do grupo</p><h2 className="mt-1 text-2xl font-black">Discussões recentes</h2></div>
              {(activeClub.discussions || []).length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="A conversa ainda não começou"
                  description="Publique a primeira pergunta, interpretação ou conexão desta leitura."
                  actionLabel="Escrever contribuição"
                  onAction={focusDiscussion}
                />
              ) : (
                activeClub.discussions.map((item) => (
                  <Card key={item._id} as="article">
                    <div className="flex items-start gap-3">
                      <Avatar name={item.user?.username || 'Leitor Bubo'} src={item.user?.avatar} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.user?.username || 'Leitor Bubo'}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">{formatRelativeTime(item.createdAt)}</span></div>
                        {(item.pageFrom !== undefined || item.pageTo !== undefined) && <span className="mt-1 block text-xs font-semibold text-[rgb(var(--bubo-color-primary))]">Páginas {item.pageFrom ?? '?'}–{item.pageTo ?? item.pageFrom ?? '?'}</span>}
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-line break-words leading-7 text-[rgb(var(--bubo-color-text-muted))]">{item.body}</p>
                    {item.insight && <div className="mt-4 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4"><span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Insight</span><p className="mt-2 break-words font-bold leading-6">{item.insight}</p></div>}
                  </Card>
                ))
              )}
            </section>
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
            <Card>
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">Membros</h2><span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{orderedMembers.length}/{activeClub.memberLimit}</span></div>
              <div className="mt-4 space-y-3">
                {orderedMembers.map((member) => {
                  const RoleIcon = member.role === 'owner' ? Crown : member.role === 'moderator' ? Shield : Users;
                  return (
                    <div key={member._id} className="flex items-center gap-3">
                      <Avatar name={member.user?.username || 'Leitor Bubo'} src={member.user?.avatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{member.user?.username || 'Leitor Bubo'}{member.isCurrentUser ? ' · você' : ''}</strong>
                        <span className="flex items-center gap-1 text-xs text-[rgb(var(--bubo-color-text-muted))]"><RoleIcon size={12} aria-hidden="true" /> {roleLabels[member.role]} · pág. {member.currentPage || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {canShareInvite && (
              <Card>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Convite privado</p>
                <strong className="mt-2 block break-all font-mono text-xl tracking-[0.12em]">{activeClub.inviteCode}</strong>
                <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Compartilhe apenas com quem deverá participar.</p>
                <Button className="mt-4 w-full" variant="secondary" leftIcon={<Copy size={16} aria-hidden="true" />} onClick={() => setInviteOpen(true)}>Abrir convite</Button>
              </Card>
            )}

            {isOwner ? (
              <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted)/0.55)] p-4 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                Como criador, você permanece responsável pelo clube. A transferência de responsabilidade será adicionada no módulo de moderação.
              </div>
            ) : (
              <Button className="w-full" variant="danger" leftIcon={<LogOut size={17} aria-hidden="true" />} onClick={() => setLeaveOpen(true)}>Sair do clube</Button>
            )}
          </aside>
        </section>
      )}

      <Modal
        isOpen={isLeaveOpen}
        onClose={() => !isMutating && setLeaveOpen(false)}
        closeOnBackdrop={!isMutating}
        closeOnEscape={!isMutating}
        size="sm"
        title="Sair deste clube?"
        description="Seu progresso e suas contribuições anteriores continuarão visíveis para preservar a conversa do grupo."
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setLeaveOpen(false)} disabled={isMutating}>Continuar no clube</Button>
            <Button variant="danger" onClick={confirmLeave} isLoading={isMutating} leftIcon={<LogOut size={17} aria-hidden="true" />}>Sair do clube</Button>
          </div>
        )}
      >
        <p className="text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Você precisará entrar novamente para atualizar progresso ou publicar novas discussões.</p>
      </Modal>

      <Modal
        isOpen={isInviteOpen}
        onClose={() => setInviteOpen(false)}
        size="sm"
        title="Convite do clube"
        description="Compartilhe o link ou o código somente com pessoas que deverão participar."
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Fechar</Button>
            <Button onClick={copyInvite} leftIcon={<Copy size={17} aria-hidden="true" />}>Copiar link</Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-[var(--bubo-radius-lg)] bg-[rgb(var(--bubo-color-primary)/0.08)] p-4 text-center">
            <Check size={20} className="mx-auto text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
            <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Código</p>
            <strong className="mt-1 block break-all font-mono text-2xl tracking-[0.14em]">{activeClub.inviteCode}</strong>
          </div>
          <Input id="club-invite-url" label="Link de convite" value={inviteUrl} readOnly onFocus={(event) => event.target.select()} />
        </div>
      </Modal>
    </div>
  );
}

function ClubMetric({ className = '', icon: Icon, label, small = false, value }) {
  return (
    <div className={`rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3 ${className}`}>
      <Icon size={18} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
      <strong className={`mt-2 block ${small ? 'text-sm' : 'text-lg'}`}>{value}</strong>
      <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">{label}</span>
    </div>
  );
}
