import React, { useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocialStore } from '../../stores/useSocialStore';
import { formatRelativeTime } from '../../utils/formatters';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import Textarea from '../ui/Textarea';

export default function CommentThread({ activityId, isOpen }) {
  const {
    commentsByActivity,
    createComment,
    deleteComment,
    fetchComments,
    loadingComments
  } = useSocialStore();
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments = commentsByActivity[activityId] || [];
  const isLoading = Boolean(loadingComments[activityId]);
  const hasLoaded = Object.prototype.hasOwnProperty.call(commentsByActivity, activityId);

  useEffect(() => {
    if (isOpen && !hasLoaded && !isLoading) {
      fetchComments(activityId).catch((error) => toast.error(error.message));
    }
  }, [activityId, fetchComments, hasLoaded, isLoading, isOpen]);

  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    const message = body.trim();
    if (!message || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createComment(activityId, message);
      setBody('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (commentId) => {
    try {
      await deleteComment(activityId, commentId);
      toast.success('Comentário removido.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="mt-4 border-t border-[rgb(var(--bubo-color-border))] pt-4" aria-label="Comentários da publicação">
      <form className="flex items-end gap-2" onSubmit={submit}>
        <div className="min-w-0 flex-1">
          <Textarea
            aria-label="Escreva um comentário"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Acrescente uma conexão, pergunta ou contraponto..."
            rows={2}
            maxLength={1200}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          aria-label="Publicar comentário"
          leftIcon={<Send size={16} aria-hidden="true" />}
          disabled={!body.trim()}
          isLoading={isSubmitting}
        >
          Enviar
        </Button>
      </form>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
              <Skeleton className="h-9 w-9" rounded="full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            </div>
          ))
        ) : comments.length === 0 ? (
          <p className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] px-4 py-5 text-center text-sm text-[rgb(var(--bubo-color-text-muted))]">
            Ainda não há comentários. Inicie uma conversa que ajude a leitura a ir mais fundo.
          </p>
        ) : (
          comments.map((comment) => (
            <article key={comment._id} className="flex gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
              <Avatar name={comment.username} src={comment.avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="block text-sm">{comment.username}</strong>
                    <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  {comment.isOwn && (
                    <button
                      type="button"
                      onClick={() => remove(comment._id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-danger)/0.1)] hover:text-[rgb(var(--bubo-color-danger))]"
                      aria-label="Remover comentário"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6">{comment.body}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
