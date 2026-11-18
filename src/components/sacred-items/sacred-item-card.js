import Link from "next/link";
import { MediaFrame } from "@/components/home/media-frame";
import { ReviewStatus } from "@/components/review/review-status";

// One link per card: the title link stretches over the whole card, so the
// card is a single tab stop with no nested interactive elements.
export function SacredItemCard({
  item,
  headingLevel: Heading = "h3",
  sizes = "(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw",
}) {
  return (
    <article
      className={`sacred-item-card${item.href ? " sacred-item-card--linked" : ""}`}
      data-category={item.category?.id}
    >
      <MediaFrame
        alt={item.image?.alt}
        className="sacred-item-card__media"
        desktopImage={item.image}
        placeholderLabel="ยังไม่มีภาพวัตถุมงคลที่ได้รับอนุมัติ"
        sizes={sizes}
      />
      <div className="sacred-item-card__body">
        {item.category ? (
          <p className="sacred-item-card__category">{item.category.label}</p>
        ) : null}
        <Heading className="sacred-item-card__title">
          {item.href ? (
            <Link
              className="sacred-item-card__link"
              href={item.href}
              prefetch={false}
            >
              {item.name}
            </Link>
          ) : (
            item.name
          )}
        </Heading>
        {item.summary ? (
          <p className="sacred-item-card__summary">{item.summary}</p>
        ) : null}
        <ReviewStatus status={item.reviewStatus} />
        {item.href ? (
          <span aria-hidden="true" className="sacred-item-card__more">
            ดูรายละเอียด
          </span>
        ) : null}
      </div>
    </article>
  );
}
