import React from 'react';
import { Archive, Gem } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { InventoryItemCard } from '../InventoryItemCard';

interface LootVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
}

export const LootVaultModal: React.FC<LootVaultModalProps> = ({ isOpen, onClose, items }) => {
  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="战利品仓库"
        icon={<Archive size={20} />}
        size="l"
        theme="guild"
        className="flex flex-col"
    >
        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#050508] relative">
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
            {items.length > 0 ? items.map((item) => (
                <InventoryItemCard 
                    key={item.id}
                    item={item}
                    variant="grid"
                    className="h-full" // Ensure full height consistency
                />
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-500">
                <Gem size={48} className="mb-3 opacity-50" />
                <span className="font-display text-lg uppercase tracking-widest">仓库为空</span>
              </div>
            )}
          </div>
        </div>
    </ModalWrapper>
  );
};