import { asc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { schema, useDb } from '@/core/db';

import type { Tag } from './tagsRepo';

export type TagWithUsage = Tag & { usage: number };

export function useTags(): TagWithUsage[] {
  const db = useDb();
  const { data: tags } = useLiveQuery(db.select().from(schema.tags).orderBy(asc(schema.tags.name)));
  const { data: links } = useLiveQuery(db.select().from(schema.transactionTags));

  return useMemo(() => {
    const usage = new Map<number, number>();
    for (const link of links) usage.set(link.tagId, (usage.get(link.tagId) ?? 0) + 1);
    return tags.map((tag) => ({ ...tag, usage: usage.get(tag.id) ?? 0 }));
  }, [tags, links]);
}
