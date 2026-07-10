import React, { useState } from 'react';
import { Brain, Download, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import { useAuthStore } from '../stores/useAuthStore';

const reviews = [
  { title: 'Noites Brancas', score: 44, summary: 'A review ainda parece rasa para salvar progresso. Inclua acontecimentos concretos e relações entre ideias.', meta: 'Páginas 1–20 · tentativa · 6 dias' },
  { title: '1984', score: 86, summary: 'Boa síntese temática com conexão clara entre enredo, controle social e ideia central.', meta: 'Páginas 301–328 · aprovada · 27 dias' },
];

const tabs = ['Visão geral', 'Deep Reviews', 'Posts', 'Badges'];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Visão geral');
  const name = user?.username || 'Leitor Ávido';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="h-28 bg-[linear-gradient(135deg,rgb(var(--bubo-color-primary)/0.14),rgb(var(--bubo-color-accent)/0.12))] sm:h-36" />
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4"><Avatar name={name} src={user?.avatar} size="xl" className="border-4 border-[rgb(var(--bubo-color-surface))]" /><div className="pb-1"><h1 className="text-2xl font-black sm:text-3xl">{name}</h1><p className="text-sm text-[rgb(var(--bubo-color-text-muted))]">@{String(name).toLowerCase().replace(/\s+/g, '')} · Explorador</p></div></div>
            <Button variant="secondary" leftIcon={<Settings size={17} />}>Editar perfil</Button>
          </div>
          <p className="mt-5 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">Lendo para lembrar, escrever melhor e conectar ideias.</p>
          <div className="mt-6 grid grid-cols-4 gap-2 border-t border-[rgb(var(--bubo-color-border))] pt-5 text-center"><div><strong className="block text-lg">2</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Livros lidos</span></div><div><strong className="block text-lg">2</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Reviews</span></div><div><strong className="block text-lg">159</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Seguidores</span></div><div><strong className="block text-lg">86%</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Depth</span></div></div>
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition ${activeTab === tab ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))]'}`}>{tab}</button>)}</div>

      {activeTab === 'Visão geral' && (
        <section className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">DNA de leitura</p><h2 className="mt-1 text-xl font-black">Seu padrão cognitivo</h2></div><div className="flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-[rgb(var(--bubo-color-primary))] text-xl font-black text-[rgb(var(--bubo-color-primary))]">86%</div></div>
            <div className="mt-6 space-y-5"><ProgressBar label="Meta anual" value={2} max={20} showValue /><ProgressBar label="XP do nível" value={1060} max={2500} showValue /><ProgressBar label="Validações aprovadas" value={1} max={2} showValue /></div>
          </Card>

          <Card>
            <div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Brain size={21} /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">IA e dados</p><h2 className="mt-1 text-xl font-black">Configuração do Bubo</h2></div></div>
            <p className="mt-5 text-[rgb(var(--bubo-color-text-muted))]">Status da IA: <strong className="text-[rgb(var(--bubo-color-text))]">Gemini configurado</strong></p>
            <div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" leftIcon={<ShieldCheck size={17} />}>Configurar IA</Button><Button variant="secondary" leftIcon={<Download size={17} />}>Exportar dados</Button><Button variant="danger" leftIcon={<LogOut size={17} />} onClick={handleLogout}>Sair</Button></div>
          </Card>
        </section>
      )}

      {activeTab === 'Deep Reviews' && <section className="grid gap-4 lg:grid-cols-2">{reviews.map((review) => <Card key={review.title}><div className="flex gap-4"><span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--bubo-color-primary)/0.25)] bg-[rgb(var(--bubo-color-primary)/0.08)] text-lg font-black text-[rgb(var(--bubo-color-primary))]">{review.score}</span><div><h2 className="font-extrabold">{review.title}</h2><p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{review.summary}</p><p className="mt-3 text-xs text-[rgb(var(--bubo-color-text-muted))]">{review.meta}</p></div></div></Card>)}</section>}

      {activeTab === 'Posts' && <Card><h2 className="text-xl font-black">Posts recentes</h2><p className="mt-3 leading-7 text-[rgb(var(--bubo-color-text-muted))]">Suas publicações e insights compartilhados aparecerão aqui em uma linha editorial consistente.</p></Card>}

      {activeTab === 'Badges' && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{['Primeiro passo', 'Semana ativa', 'Leitura profunda'].map((badge, index) => <Card key={badge} className={index > 0 ? 'opacity-65' : ''}><div className="flex items-center gap-3"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">{index === 0 ? '●' : '◇'}</span><div><h2 className="font-extrabold">{badge}</h2><p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{index === 0 ? 'Desbloqueada · Comum' : 'Em progresso'}</p></div></div></Card>)}</section>}
    </div>
  );
}
