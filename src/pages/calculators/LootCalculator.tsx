import { useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Coins, Trash2, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lootItems, LootEntry, LootItem, calculateLoot } from "@/data/calculators/loot";

const generateId = () => Math.random().toString(36).substring(2, 9);

const LootCalculator = () => {
  const [entries, setEntries] = useState<LootEntry[]>([
    { id: generateId(), item: null, quantity: 0 },
  ]);

  const result = calculateLoot(entries);

  const handleItemChange = (entryId: string, itemName: string) => {
    const item = lootItems.find((i) => i.name === itemName) || null;
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, item } : entry
      )
    );
  };

  const handleQuantityChange = (entryId: string, value: string) => {
    const quantity = Math.max(0, parseInt(value) || 0);
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, quantity } : entry
      )
    );
  };

  const handleRemoveEntry = (entryId: string) => {
    setEntries((prev) => {
      const filtered = prev.filter((entry) => entry.id !== entryId);
      return filtered.length === 0
        ? [{ id: generateId(), item: null, quantity: 0 }]
        : filtered;
    });
  };

  const handleAddEntry = () => {
    setEntries((prev) => [
      ...prev,
      { id: generateId(), item: null, quantity: 0 },
    ]);
  };

  const handleClearAll = () => {
    setEntries([{ id: generateId(), item: null, quantity: 0 }]);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("pt-BR");
  };

  return (
    <MainLayout>
      <div className="news-box">
        <div className="news-box-header">
          <Coins className="w-5 h-5" />
          <span>Calculadora de Loot</span>
        </div>
        <div className="news-box-content">
          <p className="text-muted-foreground mb-6">
            Adicione os itens do seu loot e calcule o valor total de venda no NPC.
          </p>

          {/* Header da tabela */}
          <div className="hidden md:grid md:grid-cols-[1fr_80px_60px_80px_40px] gap-2 mb-2 px-2 text-sm font-medium text-muted-foreground">
            <span>Item</span>
            <span className="text-center">Preço</span>
            <span className="text-center">Img</span>
            <span className="text-center">Qtd</span>
            <span></span>
          </div>

          {/* Lista de itens */}
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_80px_60px_80px_40px] gap-2 items-center p-2 bg-secondary/50 rounded border border-border"
              >
                {/* Select de item */}
                <Select
                  value={entry.item?.name || ""}
                  onValueChange={(value) => handleItemChange(entry.id, value)}
                >
                  <SelectTrigger className="bg-secondary text-text-dark border-border">
                    <SelectValue placeholder="Selecione um item" />
                  </SelectTrigger>
                  <SelectContent>
                    {lootItems.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Preço */}
                <div className="text-center font-medium">
                  <span className="md:hidden text-muted-foreground text-sm">Preço: </span>
                  {entry.item ? `${entry.item.price}` : "-"}
                </div>

                {/* Imagem */}
                <div className="flex justify-center">
                  {entry.item ? (
                    <img
                      src={entry.item.image}
                      alt={entry.item.name}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                      -
                    </div>
                  )}
                </div>

                {/* Quantidade */}
                <Input
                  type="number"
                  min="0"
                  value={entry.quantity || ""}
                  onChange={(e) => handleQuantityChange(entry.id, e.target.value)}
                  placeholder="0"
                  className="bg-secondary text-text-dark border-border text-center w-full"
                />

                {/* Remover */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveEntry(entry.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Botões de ação */}
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleAddEntry}
              className="bg-maroon hover:bg-maroon/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="border-border"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpar Tudo
            </Button>
          </div>

          {/* Total */}
          <div className="mt-6 p-4 bg-maroon/10 border-2 border-maroon rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Total:</span>
              <span className="text-2xl font-bold text-maroon">
                {formatNumber(result.total)} gps
              </span>
            </div>
          </div>

          {/* Resumo dos itens */}
          {result.items.length > 0 && (
            <div className="mt-4 p-4 bg-secondary/50 rounded border border-border">
              <h4 className="font-medium mb-2">Resumo:</h4>
              <div className="space-y-1 text-sm">
                {result.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.item.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatNumber(item.subtotal)} gps
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default LootCalculator;
