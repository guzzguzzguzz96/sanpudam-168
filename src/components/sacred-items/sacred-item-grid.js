import { SacredItemCard } from "@/components/sacred-items/sacred-item-card";

// Presentational grid of normalized items. A Phase 03 category filter can
// pass a filtered list (see filterSacredItemsByCategory) without changes here.
export function SacredItemGrid({ items, headingLevel, emptyMessage = null }) {
  if (items.length === 0) {
    return emptyMessage ? (
      <p className="sacred-item-grid__empty">{emptyMessage}</p>
    ) : null;
  }

  return (
    <ul className="sacred-item-grid">
      {items.map((item) => (
        <li key={item.id}>
          <SacredItemCard item={item} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
