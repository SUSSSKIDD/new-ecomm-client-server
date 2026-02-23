/**
 * Build a standard paginated response.
 * Replaces 6+ duplicate `{ data, meta: { page, limit, total, totalPages } }` blocks.
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number | string,
  limit: number | string,
) {
  const p = Number(page);
  const l = Number(limit);
  return {
    data,
    meta: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l),
    },
  };
}
