import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Lock, Plus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClubCard from '../components/clubs/ClubCard';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import Textarea from '../components/ui/Textarea';
import { useClubStore } from '../stores/useClubStore';
import { useLibraryStore } from '../stores/useLibraryStore';

const filters = [
  { key: 'all', label: 'Todos' },
  { key: 'mine', label: 'Meus clubes' },
  { key: 'discover', label: 'Descobrir' },
];

const initialForm = {
  name: '',
  description: '',
  bookId: '',
  visibility: 'public',
  startDate: '',
  targetDate: '',
  memberLimit: 30,
};

const localDateValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 10);
};

export default function ClubsPage() {
  const navigate = useNavigate();
  const {
    clubs,
    createClub,
    error,
    fetchClubs,
    isLoading,
    isMutating,
    joinClub,
  } = useClubStore();
  const { books, fetchLibrary, isLoading: libraryLoading } = useLibraryStore();
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchClubs(scope).catch(() => {});
  }, [fetchClubs, scope]);

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  const availableBooks = useMemo(
    () => books.filter((userBook) => userBook.bookId?._id),
    [books],
  );

  const visibleClubs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clubs;
    return clubs.filter((club) => `${club.name} ${club.description || ''} ${club.book?.title || ''} ${club.owner?.username || ''}`.toLowerCase().includes(normalized));
  }, [clubs, query]);

  const updateForm = (field) => (event) => {
    const value = field === 'memberLimit' ? Number(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    if (availableBooks.length === 0) {
      navigate('/discover');
      return;
    }
    setForm({
      ...initialForm,
      bookId: availableBooks[0]?.bookId?._id || '',
      startDate: localDateValue(),
    });
    setCreateOpen(true);
  };

  const submitClub = async (event) => {
    event.preventDefault();
    try {
      const club = await createClub({
        ...form,
        targetDate: form.targetDate || undefined,
      });
      toast.success('Clube criado. A leitura coletiva pode começar.');
      setCreateOpen(false);
      navigate(`/clubs/${club._id}`);
    } catch (createError) {
      toast.error(createError.message);
    }
  };

  const joinPublicClub = async (club) => {
    setJoiningId(club._id);
    try {
      await joinClub(club._id);
      toast.success(`Você entrou em “${club.name}”.`);
      await fetchClubs(scope);
    } catch (joinError) {
      toast.error(joinError.message);
    } finally {
      setJoiningId(null);
    }
  };

  const clearSearchOrDiscover = () => {
    if (query) {
      setQuery('');
      return;
    }
    setScope('discover');
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Leitura coletiva</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Clubes de leitura</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">
            Leia no seu ritmo, acompanhe o grupo e transforme capítulos em discussões que realmente permanecem.
          </p>
        </div>
        <Button
          leftIcon={availableBooks.length > 0 ? <Plus size={18} aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}
          onClick={openCreate}
          disabled={libraryLoading}
        >
          {availableBooks.length > 0 ? 'Criar clube' : 'Adicionar livro para criar'}
        </Button>
      </section>

      <section className="grid gap-4 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 shadow-[var(--bubo-shadow-sm)] lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" role="tablist" aria-label="Filtrar clubes">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={scope === filter.key}
              onClick={() => setScope(filter.key)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${scope === filter.key ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="relative">
          <span className="sr-only">Buscar clubes</span>
          <Compass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Clube, livro ou criador"
            className="min-h-11 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-10 pr-3 text-sm outline-none transition focus:border-[rgb(var(--bubo-color-primary))] focus:ring-4 focus:ring-[rgb(var(--bubo-color-primary)/0.1)]"
          />
        </label>
      </section>

      {isLoading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4">
              <div className="flex gap-4"><Skeleton className="aspect-[2/3] w-24" /><div className="flex-1"><Skeleton className="h-5 w-1/2" /><Skeleton className="mt-3 h-6 w-full" /><Skeleton className="mt-2 h-4 w-2/3" /></div></div>
              <Skeleton className="mt-5 h-16 w-full" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))}
        </section>
      ) : error && clubs.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Não foi possível carregar os clubes"
          description={error}
          actionLabel="Tentar novamente"
          onAction={() => fetchClubs(scope).catch(() => {})}
          secondaryActionLabel="Voltar ao início"
          onSecondaryAction={() => navigate('/')}
        />
      ) : visibleClubs.length === 0 ? (
        <EmptyState
          icon={scope === 'mine' ? BookOpen : Users}
          title={scope === 'mine' ? 'Você ainda não participa de clubes' : 'Nenhum clube encontrado'}
          description={scope === 'mine' ? 'Descubra uma leitura coletiva pública ou crie um clube a partir do seu acervo.' : 'Tente outra busca ou seja a primeira pessoa a criar um clube para esse livro.'}
          actionLabel={scope === 'mine' ? 'Descobrir clubes' : query ? 'Limpar busca' : availableBooks.length > 0 ? 'Criar clube' : 'Adicionar livro'}
          onAction={scope === 'mine' ? () => setScope('discover') : query ? clearSearchOrDiscover : openCreate}
          secondaryActionLabel={scope === 'mine' && availableBooks.length > 0 ? 'Criar clube' : undefined}
          onSecondaryAction={scope === 'mine' && availableBooks.length > 0 ? openCreate : undefined}
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleClubs.map((club) => (
            <ClubCard
              key={club._id}
              club={club}
              onJoin={joinPublicClub}
              isJoining={joiningId === club._id}
            />
          ))}
        </section>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isMutating && setCreateOpen(false)}
        closeOnBackdrop={!isMutating}
        closeOnEscape={!isMutating}
        title="Criar clube de leitura"
        description="Defina o livro, o ritmo e quem poderá participar."
        size="lg"
        footer={availableBooks.length > 0 ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={isMutating}>Cancelar</Button>
            <Button type="submit" form="create-club-form" isLoading={isMutating}>Criar clube</Button>
          </div>
        ) : undefined}
      >
        {availableBooks.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Adicione um livro primeiro"
            description="Clubes precisam estar ligados a uma leitura real do seu acervo."
            actionLabel="Descobrir livros"
            onAction={() => { setCreateOpen(false); navigate('/discover'); }}
            secondaryActionLabel="Fechar"
            onSecondaryAction={() => setCreateOpen(false)}
          />
        ) : (
          <form id="create-club-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submitClub}>
            <div className="sm:col-span-2">
              <Input label="Nome do clube" value={form.name} onChange={updateForm('name')} minLength={3} maxLength={80} required placeholder="Ex.: Expedição por Arrakis" />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="Descrição" value={form.description} onChange={updateForm('description')} rows={4} maxLength={600} placeholder="Qual é a proposta desta leitura coletiva?" description={`${form.description.length}/600 caracteres`} />
            </div>
            <div className="sm:col-span-2">
              <Select label="Livro" value={form.bookId} onChange={updateForm('bookId')} required>
                {availableBooks.map((userBook) => (
                  <option key={userBook._id} value={userBook.bookId._id}>{userBook.bookId.title} — {userBook.bookId.author}</option>
                ))}
              </Select>
            </div>
            <Select label="Visibilidade" value={form.visibility} onChange={updateForm('visibility')}>
              <option value="public">Público</option>
              <option value="private">Privado com convite</option>
            </Select>
            <Input label="Limite de membros" type="number" value={form.memberLimit} onChange={updateForm('memberLimit')} min={2} max={100} required />
            <Input label="Início" type="date" value={form.startDate} onChange={updateForm('startDate')} required />
            <Input label="Meta de conclusão" type="date" value={form.targetDate} onChange={updateForm('targetDate')} min={form.startDate || undefined} description="Opcional" />
            {form.visibility === 'private' && (
              <div className="sm:col-span-2 flex gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 text-sm text-[rgb(var(--bubo-color-text-muted))]">
                <Lock className="shrink-0 text-[rgb(var(--bubo-color-primary))]" size={19} aria-hidden="true" />
                Um código de convite será gerado automaticamente e ficará visível para owner e moderadores.
              </div>
            )}
          </form>
        )}
      </Modal>

      {availableBooks.length === 0 && !libraryLoading && (
        <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] p-4 text-sm text-[rgb(var(--bubo-color-text-muted))]">
          Para criar um clube, <Link className="font-bold text-[rgb(var(--bubo-color-primary))] hover:underline" to="/discover">adicione um livro ao seu acervo</Link>.
        </div>
      )}
    </div>
  );
}
