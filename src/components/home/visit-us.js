import { Container } from "@/components/ui/container";
import { ContactActions } from "@/components/ui/contact-actions";
import { Icon } from "@/components/ui/icons";
import { SectionIntro } from "@/components/home/section-intro";
import { ReviewNote } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";
import { getContactActions } from "@/lib/contact-actions";

// Client Review only: actions replaces the siteConfig contact actions (built
// with getContactActions from review data), and directionsNote labels an
// unverified or unusable map link. Without them the section is unchanged.
export function VisitUs({ data, actions: reviewActions = null, directionsNote = null }) {
  const actions = reviewActions ?? getContactActions(["maps", "line", "phone"]);
  const hasDirections = actions.some((action) => action.id === "maps");

  return (
    <Section id="visit" aria-labelledby="visit-us-title" className="home-visit">
      <Container className="home-visit__layout">
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
            emptyMessage="ปุ่มนำทางและช่องทางติดต่อจะแสดงเมื่อได้รับข้อมูลที่ยืนยันแล้ว"
          />
        </div>

        {/* No map embed until the owner verifies the location. */}
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
      </Container>
    </Section>
  );
}
