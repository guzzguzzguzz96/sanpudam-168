import { PageHeader } from "@/components/pages/page-header";
import { ReviewNote } from "@/components/review/review-status";
import { ContactActions } from "@/components/ui/contact-actions";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icons";
import { Section } from "@/components/ui/section";
import { getContactActions } from "@/lib/contact-actions";

// /visit from the visit view data (src/server/site/pages.js). Imported
// contact values are text only; actions come from getContactActions for
// the directions link and, on the public site, owner-verified channels.
// No transport routes, parking, coordinates, or embed are invented.
export function VisitView({ view }) {
  const details = [
    view.hours ? { id: "hours", icon: "clock", label: "เวลาเปิดทำการ", ...view.hours } : null,
    view.address ? { id: "address", icon: "mapPin", label: "ที่อยู่", ...view.address } : null,
    view.locationShort ? { id: "location", icon: "route", label: "จุดสังเกต", ...view.locationShort } : null,
  ].filter(Boolean);
  const channels = [...view.contacts, ...view.social];
  const actions = [
    ...(view.directions?.href ? getContactActions(["maps"], { directionsUrl: view.directions.href }) : []),
    ...(view.verifiedContact ? getContactActions(["line", "phone"], view.verifiedContact) : []),
  ];

  return (
    <>
      <PageHeader current="เยี่ยมชม" eyebrow="วางแผนการเดินทาง" title={"การเยี่ยมชม\u200Bและการเดินทาง"} />

      <Section aria-label="ข้อมูลการเยี่ยมชม" className="home-visit content-page__section content-page__section--first">
        <Container className="home-visit__layout">
          <div className="home-visit__content">
            {details.length ? (
              <dl className="home-visit__details">
                {details.map((detail) => (
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
            ) : null}

            <ContactActions
              actions={actions}
              className="home-visit__actions"
              emptyMessage="ปุ่มนำทางและช่องทางติดต่อจะแสดงเมื่อได้รับข้อมูลที่ยืนยันแล้ว"
            />

            {channels.length ? (
              <div className="content-page__channels">
                <h2 className="content-page__subheading">ช่องทางติดต่อ</h2>
                <dl className="content-page__facts">
                  {channels.map((channel) => (
                    <div key={channel.id} className="content-page__fact">
                      <dt>{channel.label}</dt>
                      <dd>
                        <span className="content-page__channel-value">{channel.value}</span>
                        <ReviewNote note={channel.note} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>

          {/* No map embed: there is no verified embed source. */}
          <div className="home-visit__map">
            <span aria-hidden="true" className="home-visit__map-pin">
              <Icon name="mapPin" size={32} />
            </span>
            <p>
              {view.directions?.href
                ? "เปิดเส้นทางไปยังศาลได้จากปุ่ม “นำทางด้วย Google Maps”"
                : "แผนที่จะแสดงเมื่อได้รับตำแหน่งที่ยืนยันแล้ว"}
            </p>
            <ReviewNote note={view.directions?.note} />
          </div>
        </Container>
      </Section>
    </>
  );
}
