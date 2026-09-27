import { TabShell } from '../../features/shell/TabShell';

export default function CommunityScreen() {
  return (
    <TabShell
      title="Comunidade"
      subtitle="Leia junto, sem spoilers."
      mascot="emptyCommunity"
      emptyTitle="A comunidade chega em breve"
      emptyDescription="Clubes de leitura e debates vão respeitar o ponto em que cada pessoa está no livro."
      upcoming={[
        'Clubes de leitura com proteção anti-spoiler',
        'Debates e enquetes por capítulo',
        'Atividade dos amigos que você segue',
      ]}
    />
  );
}
