import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Clock, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';

const todayValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

export default function ReadingSessionModal({ isOpen, onClose, onSaved, userBook }) {
  const currentPage = Number(userBook?.currentPage) || 0;
  const totalPages = Number(userBook?.effectiveTotalPages)
    || Number(userBook?.totalPagesOverride)
    || Number(userBook?.bookId?.totalPages)
    || 0;
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [focus, setFocus] = useState('not-informed');
  const [note, setNote] = useState('');
  const [readAt, setReadAt] = useState(todayValue());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPageFrom(String(currentPage + 1));
    setPageTo('');
    setDurationMinutes('');
    setFocus('not-informed');
    setNote('');
    setReadAt(todayValue());
  }, [currentPage, isOpen, userBook?._id]);

  const pagesRead = useMemo(() => {
    const from = Number.parseInt(pageFrom, 10);
    const to = Number.parseInt(pageTo, 10);
    return Number.isInteger(from) && Number.isInteger(to) && to >= from ? to - from + 1 : 0;
  }, [pageFrom, pageTo]);

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const { data } = await api.post(`/books/library/${userBook._id}/sessions`, {
        pageFrom,
        pageTo,
        durationMinutes,
        focus,
        note,
        readAt: readAt ? `${readAt}T00:00:00.000Z` : undefined,
      });
      toast.success(`Sessão registrada com ${data.session.pagesRead} páginas.`);
      await Promise.resolve(onSaved?.(data));
      onClose?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Não foi possível registrar a sessão.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!userBook) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      size="lg"
      title="Registrar sessão de leitura"
      description={`Atualize seu progresso em “${userBook.bookId?.title || 'esta leitura'}” e preserve o contexto da sessão.`}
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" form="reading-session-form" isLoading={isSaving}>Salvar sessão</Button>
        </div>
      )}
    >
      <form id="reading-session-form" onSubmit={submit} className="space-y-6">
        <div className="grid gap-3 rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted)/0.55)] p-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><BookOpen size={18} aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[rgb(var(--bubo-color-text-muted))]">Página atual</p><strong>{currentPage}</strong></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Target size={18} aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[rgb(var(--bubo-color-text-muted))]">Total da edição</p><strong>{totalPages || 'Não informado'}</strong></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Clock size={18} aria-hidden="true" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[rgb(var(--bubo-color-text-muted))]">Nesta sessão</p><strong>{pagesRead || 0} páginas</strong></div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Página inicial"
            type="number"
            min="1"
            max={totalPages || undefined}
            value={pageFrom}
            onChange={(event) => setPageFrom(event.target.value)}
            required
            description="Você também pode registrar uma sessão anterior ou uma releitura."
          />
          <Input
            label="Página final"
            type="number"
            min={Number(pageFrom) || 1}
            max={totalPages || undefined}
            value={pageTo}
            onChange={(event) => setPageTo(event.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Duração em minutos"
            type="number"
            min="0"
            max="1440"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            placeholder="Ex.: 35"
          />
          <Select label="Concentração" value={focus} onChange={(event) => setFocus(event.target.value)}>
            <option value="not-informed">Não informar</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
          </Select>
          <Input
            label="Data da leitura"
            type="date"
            max={todayValue()}
            value={readAt}
            onChange={(event) => setReadAt(event.target.value)}
            leftIcon={<Calendar size={17} aria-hidden="true" />}
            required
          />
        </div>

        <Textarea
          label="Observação da sessão"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Anote o que chamou atenção, onde parou ou o que deseja retomar depois."
          description={`${note.length}/2000 caracteres`}
        />
      </form>
    </Modal>
  );
}
