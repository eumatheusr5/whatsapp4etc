import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Tag as TagIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

interface Tag {
  id: string;
  name: string;
  color: string;
  usage_count: number;
}

const PRESET_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

export function TagsTab() {
  const qc = useQueryClient();
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[]>('/tags'),
  });

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const create = useMutation({
    mutationFn: () => api.post('/tags', { name: name.trim(), color }),
    onSuccess: () => {
      setName('');
      setColor(PRESET_COLORS[0]);
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag criada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; name?: string; color?: string }) =>
      api.patch(`/tags/${input.id}`, { name: input.name, color: input.color }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark p-4 sm:p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova tag
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            className="input flex-1"
            placeholder="Nome (ex: VIP, Urgente, Fornecedor)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
          <button
            className="btn-primary text-sm whitespace-nowrap"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus className="w-4 h-4" /> Criar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                'w-7 h-7 rounded-full border-2 ' +
                (color === c ? 'border-wa-text dark:border-white' : 'border-transparent')
              }
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-wa-bubble-dark rounded-xl border border-wa-divider dark:border-wa-divider-dark">
        <div className="p-4 sm:p-6 border-b border-wa-divider dark:border-wa-divider-dark">
          <h2 className="font-semibold flex items-center gap-2">
            <TagIcon className="w-4 h-4" /> Suas tags
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-wa-muted">Carregando...</div>
        ) : tags.length === 0 ? (
          <div className="p-6 text-sm text-wa-muted">Nenhuma tag cadastrada.</div>
        ) : (
          <ul className="divide-y divide-wa-divider dark:divide-wa-divider-dark">
            {tags.map((t) => (
              <TagRow
                key={t.id}
                tag={t}
                onSave={(name, color) => update.mutate({ id: t.id, name, color })}
                onDelete={() => {
                  if (confirm(`Remover tag "${t.name}"?`)) remove.mutate(t.id);
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TagRow({
  tag,
  onSave,
  onDelete,
}: {
  tag: Tag;
  onSave: (name: string, color: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const dirty = name !== tag.name || color !== tag.color;

  return (
    <li className="p-3 sm:p-4 flex flex-wrap items-center gap-3">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-wa-divider dark:border-wa-divider-dark"
      />
      <input
        className="input flex-1 min-w-[140px]"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
      />
      <span className="text-xs text-wa-muted whitespace-nowrap">
        {tag.usage_count} uso{tag.usage_count === 1 ? '' : 's'}
      </span>
      <button
        className="btn-secondary text-xs"
        disabled={!dirty}
        onClick={() => onSave(name.trim(), color)}
      >
        <Save className="w-3.5 h-3.5" /> Salvar
      </button>
      <button className="btn-secondary text-xs text-red-500" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
