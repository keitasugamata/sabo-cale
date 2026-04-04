import { useState, useEffect, useCallback } from 'react';
import { getAllTags, saveTag, deleteTag as dbDeleteTag } from '../db';
import { generateId } from '../utils/dateUtils';

const DEFAULT_TAGS = [
  // 誰と
  { id: 'w-1', category: 'with', label: '一人で', color: '#7C3AED', usageCount: 0 },
  { id: 'w-2', category: 'with', label: '友達と', color: '#2563EB', usageCount: 0 },
  { id: 'w-3', category: 'with', label: '家族と', color: '#059669', usageCount: 0 },
  { id: 'w-4', category: 'with', label: '仕事仲間と', color: '#D97706', usageCount: 0 },
  // 何をする
  { id: 'a-1', category: 'what', label: 'カフェ', color: '#DB2777', usageCount: 0 },
  { id: 'a-2', category: 'what', label: 'ランチ', color: '#EA580C', usageCount: 0 },
  { id: 'a-3', category: 'what', label: '作業', color: '#0891B2', usageCount: 0 },
  { id: 'a-4', category: 'what', label: '勉強', color: '#7C3AED', usageCount: 0 },
  { id: 'a-5', category: 'what', label: '運動', color: '#16A34A', usageCount: 0 },
  { id: 'a-6', category: 'what', label: '買い物', color: '#DC2626', usageCount: 0 },
  // どこで
  { id: 'p-1', category: 'where', label: '自宅', color: '#7C3AED', usageCount: 0 },
  { id: 'p-2', category: 'where', label: 'カフェ', color: '#92400E', usageCount: 0 },
  { id: 'p-3', category: 'where', label: 'オフィス', color: '#1D4ED8', usageCount: 0 },
  { id: 'p-4', category: 'where', label: '屋外', color: '#15803D', usageCount: 0 },
  { id: 'p-5', category: 'where', label: 'ジム', color: '#B45309', usageCount: 0 },
];

export function useTags() {
  const [tags, setTags] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAllTags().then(async (data) => {
      // 既存データに where カテゴリがない場合は追加
      const whereExists = data.some((t) => t.category === 'where');
      if (data.length === 0) {
        await Promise.all(DEFAULT_TAGS.map(saveTag));
        setTags(DEFAULT_TAGS);
      } else if (!whereExists) {
        const whereTags = DEFAULT_TAGS.filter((t) => t.category === 'where');
        await Promise.all(whereTags.map(saveTag));
        setTags([...data, ...whereTags]);
      } else {
        setTags(data);
      }
      setLoaded(true);
    });
  }, []);

  const addTag = useCallback(async (input) => {
    const tag = {
      id: input.id || generateId(),
      category: input.category || '',
      label: input.label,
      color: input.color,
      usageCount: input.usageCount ?? 0,
    };
    await saveTag(tag);
    setTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
    return tag;
  }, []);

  const removeTag = useCallback(async (id) => {
    await dbDeleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTag = useCallback(async (id, patch) => {
    setTags((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      const target = updated.find((t) => t.id === id);
      if (target) saveTag(target);
      return updated;
    });
  }, []);

  const incrementUsage = useCallback((id) => {
    if (!id) return;
    setTags((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, usageCount: (t.usageCount || 0) + 1 } : t
      );
      const target = updated.find((t) => t.id === id);
      if (target) saveTag(target);
      return updated;
    });
  }, []);

  const getTagsByCategory = useCallback(
    (category) =>
      tags.filter((t) => t.category === category).sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)),
    [tags]
  );

  return { tags, loaded, addTag, removeTag, updateTag, incrementUsage, getTagsByCategory };
}
