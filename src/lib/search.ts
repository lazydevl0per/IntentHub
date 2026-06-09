import { prisma } from "@/lib/prisma";

export async function fullTextSearch(
  repositoryId: string,
  query: string,
  limit = 10
) {
  const results = await prisma.$queryRaw<
    Array<{
      entity_type: string;
      entity_id: string;
      title: string;
      content: string;
      rank: number;
    }>
  >`
    SELECT * FROM (
      SELECT 'OBJECTIVE' as entity_type, o.id as entity_id, o.title, o.description as content,
        ts_rank(
          to_tsvector('english', coalesce(o.title, '') || ' ' || coalesce(o.description, '')),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM "Objective" o
      WHERE o."repositoryId" = ${repositoryId}
        AND to_tsvector('english', coalesce(o.title, '') || ' ' || coalesce(o.description, ''))
            @@ plainto_tsquery('english', ${query})

      UNION ALL

      SELECT 'PLAN' as entity_type, p.id as entity_id, p.title,
        coalesce(p.description, '') || ' ' || coalesce(p.approach, '') as content,
        ts_rank(
          to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.approach, '')),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM "Plan" p
      JOIN "Objective" o ON o.id = p."objectiveId"
      WHERE o."repositoryId" = ${repositoryId}
        AND to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.approach, ''))
            @@ plainto_tsquery('english', ${query})

      UNION ALL

      SELECT 'DECISION' as entity_type, d.id as entity_id, 'Decision' as title, d.rationale as content,
        ts_rank(
          to_tsvector('english', coalesce(d.rationale, '')),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM "Decision" d
      JOIN "Objective" o ON o.id = d."objectiveId"
      WHERE o."repositoryId" = ${repositoryId}
        AND to_tsvector('english', coalesce(d.rationale, ''))
            @@ plainto_tsquery('english', ${query})
    ) combined
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return results;
}
