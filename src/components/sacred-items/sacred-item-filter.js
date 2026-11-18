"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SacredItemGrid } from "@/components/sacred-items/sacred-item-grid";
import { activeCategory, filterSacredItemsByCategory, getSacredItemCategories } from "@/lib/sacred-items";

// Category filter for /sakkara, compatible with the legacy links
// (/sakkara?cat=<category slug>). The server renders the full list, so the
// page stays cacheable; this client component only narrows it. The query
// value is used only when it is a well-formed slug of a category present
// in the list (activeCategory); anything else shows every item. It never
// reaches the server.

export function SacredItemFilter({ items, headingLevel, emptyMessage }) {
  const query = useSearchParams();
  const categories = getSacredItemCategories(items);
  const active = activeCategory(query.get("cat"), categories);
  const visible = filterSacredItemsByCategory(items, active);

  return (
    <>
      {categories.length > 1 ? (
        <nav aria-label="หมวดหมู่วัตถุมงคล" className="sacred-item-filter">
          <ul className="sacred-item-filter__list">
            <li>
              <Link aria-current={active ? undefined : "page"} className="sacred-item-filter__link" href="/sakkara" prefetch={false} scroll={false}>
                ทั้งหมด
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  aria-current={active === category.id ? "page" : undefined}
                  className="sacred-item-filter__link"
                  href={`/sakkara?cat=${encodeURIComponent(category.id)}`}
                  prefetch={false}
                  scroll={false}
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <SacredItemGrid emptyMessage={emptyMessage} headingLevel={headingLevel} items={visible} />
    </>
  );
}
