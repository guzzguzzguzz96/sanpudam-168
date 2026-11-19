import { Container } from "@/components/ui/container";
import { ContactActions } from "@/components/ui/contact-actions";
import { Icon } from "@/components/ui/icons";
import { MapEmbed } from "@/components/ui/map-embed";
import { SectionIntro } from "@/components/home/section-intro";
import { ReviewNote } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";
import { getContactActions } from "@/lib/contact-actions";

// actions replaces the siteConfig contact actions (built with
// getContactActions from public or review data). directionsNote (review
// only) labels an unverified or unusable map link. mapEmbedUrl (public site,
// owner-verified contact only; src/config/map-embed.js) shows the embedded
// map; without it the placeholder box stays exactly as before, except on
// the public site (hidePending), where a missing map or missing actions
// render nothing instead of a "pending" message.
export function VisitUs({ data, actions: reviewActions = null, directionsNote = null, mapEmbedUrl = null, mapName = null, hidePending = false }) {
  const actions = reviewActions ?? getContactActions(["maps", "line", "phone"]);
  const hasDirections = actions.some((action) => action.id === "maps");
  const showMapBox = Boolean(mapEmbedUrl) || !hidePending;

  return (
    <Section id="visit" aria-labelledby="visit-us-title" className="home-visit">
      <Container className={`home-visit__layout${showMapBox ? "" : " home-visit__layout--single"}`}>
        <div className="home-visit__content">
          <SectionIntro
            id="visit-us-title"
            eyebrow="วางแผนการเดินทาง"
            title="การเยี่ยมชมและการเดินทาง"
          />
          <dl className="home-visit__details">
            {data.map((detail) => (
              <div key={detail.id} className="home-visit__detail">
                <dt>
                  <span className="home-visit__icon">
                    <Icon name={detail.icon} />
                  </span>
                  {detail.label}
                </dt>
                <dd>
                  {detail.value}
                  <ReviewNote note={detail.note} />
                </dd>
              </div>
            ))}
          </dl>
          <ContactActions
            actions={actions}
            className="home-visit__actions"
            emptyMessage={hidePending ? null : "ปุ่มนำทางและช่องทางติดต่อจะแสดงเมื่อได้รับข้อมูลที่ยืนยันแล้ว"}
          />
        </div>

        {mapEmbedUrl ? (
          <MapEmbed name={mapName} src={mapEmbedUrl} />
        ) : !showMapBox ? null : (
          <div className="home-visit__map">
            <span aria-hidden="true" className="home-visit__map-pin">
              <Icon name="mapPin" size={32} />
            </span>
            <p>
              {hasDirections
                ? "เปิดเส้นทางไปยังศาลได้จากปุ่ม “นำทางด้วย Google Maps”"
                : "แผนที่จะแสดงเมื่อได้รับตำแหน่งที่ยืนยันแล้ว"}
            </p>
            <ReviewNote note={directionsNote} />
          </div>
        )}
      </Container>
    </Section>
  );
}
