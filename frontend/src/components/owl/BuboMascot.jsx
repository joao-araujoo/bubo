import React from 'react';
import BuboBrandAsset from '../brand/BuboBrandAsset';

const stateLabel = {
  idle: 'Bubo pronto para orientar sua leitura',
  thinking: 'Bubo analisando sua Deep Review',
  guiding: 'Bubo apresentando caminhos para aprofundar a leitura',
  approved: 'Bubo celebrando uma Deep Review aprovada',
};

export default function BuboMascot({ state = 'idle', size = 120 }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full p-3 ${
        state === 'approved'
          ? 'bg-[rgb(var(--bubo-color-success)/0.1)]'
          : state === 'guiding'
            ? 'bg-[rgb(var(--bubo-color-warning)/0.1)]'
            : 'bg-[rgb(var(--bubo-color-primary)/0.08)]'
      }`}
      style={{ width: size, height: size }}
    >
      <BuboBrandAsset
        alt={stateLabel[state] || stateLabel.idle}
        size={Math.max(48, size - 24)}
        state={state}
        variant="mascot"
      />
      {state === 'thinking' && (
        <span
          aria-hidden="true"
          className="absolute inset-1 animate-pulse rounded-full border border-[rgb(var(--bubo-color-primary)/0.28)]"
        />
      )}
    </div>
  );
}
