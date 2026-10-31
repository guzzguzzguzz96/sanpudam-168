// View-model helpers for sacred items. Components consume only the
// normalized shape, so mock data and future CMS records can share them.
//
// Normalized item:
// {
//   id: string,
//   name: string,
//   summary: string | null,
//   category: { id: string, label: string } | null,
//   image: { src, alt, width, height, focalPoint } | null,
//   href: string | null,   // detail route, only when it exists
//   reviewStatus: { tone, label, fields } | null,   // Client Review only
// }
//
// No price, stock, or availability fields are part of this model.

export function normalizeSacredItem(raw) {
  const category =
    raw.category && raw.category.id && raw.category.label
      ? { id: String(raw.category.id), label: raw.category.label }
      : null;

  return {
    id: String(raw.id),
    name: raw.name,
    summary: raw.summary ?? null,
    category,
    image: raw.image?.src ? raw.image : null,
    href: raw.href ?? null,
    ...(raw.reviewStatus ? { reviewStatus: raw.reviewStatus } : {}),
  };
}

// Unique categories in display order, with item counts. Prepared for the
// Phase 03 category filter; not rendered as controls before then.
export function getSacredItemCategories(items) {
  const categories = new Map();

  for (const item of items) {
    if (!item.category) {
      continue;
    }

    const existing = categories.get(item.category.id);
    categories.set(item.category.id, {
      ...item.category,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...categories.values()];
}

export function filterSacredItemsByCategory(items, categoryId) {
  return categoryId
    ? items.filter((item) => item.category?.id === categoryId)
    : items;
}
