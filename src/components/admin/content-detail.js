import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/pages/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

// Read-only detail of one content record (/admin/content/[type]/[id]).
// Receives the detail DTO only. All text is rendered as React text with
// line breaks preserved: stored values are shown exactly, never as HTML.
// No edit or publish actions.

const TRAIL = [{ href: "/admin", label: "ผู้ดูแลระบบ" }, { href: "/admin/content", label: "รายการเนื้อหา" }];
const EMPTY = "ไม่มีข้อมูล";

function BackLink({ href }) {
  return (
    <p className="admin-detail__back">
      <Link href={href} prefetch={false}>
        ← กลับไปยังรายการเนื้อหา
      </Link>
    </p>
  );
}

function Status({ status, tone }) {
  return <span className={`admin-status admin-status--${status.known ? tone : "unknown"}`}>{status.label}</span>;
}

function ImageValue({ image }) {
  if (!image) return <p className="admin-detail__empty">{EMPTY}</p>;
  return (
    <div className="admin-image">
      {image.thumbnail ? (
        <Image
          alt={image.alt}
          className="admin-image__thumb"
          height={image.thumbnail.height}
          sizes="(max-width: 47.99rem) 100vw, 240px"
          src={image.thumbnail.src}
          unoptimized
          width={image.thumbnail.width}
        />
      ) : (
        <div className="admin-image__none">ไม่มีภาพตัวอย่าง</div>
      )}
      <dl className="admin-image__facts">
        <div>
          <dt>คำบรรยายภาพ</dt>
          <dd>{image.caption || EMPTY}</dd>
        </div>
        <div>
          <dt>ข้อความแทนภาพ</dt>
          <dd>{image.alt || EMPTY}</dd>
        </div>
        <div>
          <dt>สถานะไฟล์</dt>
          <dd>{image.file ?? image.mapping.label}</dd>
        </div>
        {image.rights ? (
          <div>
            <dt>สิทธิ์การใช้ภาพ</dt>
            <dd>{image.rights.label}</dd>
          </div>
        ) : null}
        {image.approval ? (
          <div>
            <dt>การอนุมัติภาพ</dt>
            <dd>{image.approval.label}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function FieldValue({ field }) {
  switch (field.kind) {
    case "image":
      return <ImageValue image={field.value} />;
    case "images":
      return field.value.length ? (
        <div className="admin-image-list">
          {field.value.map((image, index) => (
            <ImageValue image={image} key={index} />
          ))}
        </div>
      ) : (
        <p className="admin-detail__empty">{EMPTY}</p>
      );
    case "list":
      return field.value.length ? (
        <ol className="admin-detail__list">
          {field.value.map((item, index) => (
            <li key={index}>
              <span className="admin-detail__list-primary">{item.primary}</span>
              {item.secondary ? <span className="admin-detail__text">{item.secondary}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="admin-detail__empty">{EMPTY}</p>
      );
    default:
      return field.value ? (
        <p className={`admin-detail__text${field.kind === "longtext" ? " admin-detail__text--long" : ""}`}>{field.value}</p>
      ) : (
        <p className="admin-detail__empty">{EMPTY}</p>
      );
  }
}

export function ContentDetail({ detail, backHref }) {
  const { placeholders } = detail;
  return (
    <>
      <PageHeader current={detail.title} eyebrow={detail.type.label} title={detail.title} trail={TRAIL}>
        <BackLink href={backHref} />
      </PageHeader>
      <Section as="div" className="admin-section">
        <Container>
          <div className="admin-detail">
            <section aria-labelledby="admin-detail-status" className="admin-detail__card">
              <h2 id="admin-detail-status" className="admin-detail__heading">
                สถานะ
              </h2>
              <dl className="admin-detail__fields">
                <div className="admin-detail__field">
                  <dt>ประเภทเนื้อหา</dt>
                  <dd>{detail.type.label}</dd>
                </div>
                <div className="admin-detail__field">
                  <dt>สถานะการเผยแพร่</dt>
                  <dd>
                    <Status status={detail.publication} tone="publication" />
                  </dd>
                </div>
                <div className="admin-detail__field">
                  <dt>สถานะการตรวจทาน</dt>
                  <dd>
                    <Status status={detail.review} tone="review" />
                  </dd>
                </div>
                {detail.reviewNote ? (
                  <div className="admin-detail__field">
                    <dt>หมายเหตุการตรวจทาน</dt>
                    <dd className="admin-detail__text admin-detail__text--long">{detail.reviewNote}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="admin-panel__text">ดูได้อย่างเดียว ยังแก้ไขหรือเผยแพร่จากหน้านี้ไม่ได้</p>
            </section>

            <section aria-labelledby="admin-detail-placeholders" className="admin-detail__card">
              <h2 id="admin-detail-placeholders" className="admin-detail__heading">
                ข้อความตัวอย่างที่รอเจ้าของยืนยัน
              </h2>
              {placeholders.open.length ? (
                <ul className="admin-detail__flags">
                  {placeholders.open.map((flag, index) => (
                    <li key={`${flag.path}-${index}`}>
                      <span className="admin-detail__list-primary">{flag.label}</span>
                      <span className="admin-status admin-status--unknown">{flag.status}</span>
                      {flag.note ? <span className="admin-detail__text">หมายเหตุ: {flag.note}</span> : null}
                      {flag.flaggedAt ? <span className="admin-detail__meta">บันทึกเมื่อ {flag.flaggedAt}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-detail__empty">ไม่มีข้อความตัวอย่างที่ค้างอยู่</p>
              )}
              {placeholders.resolvedCount ? <p className="admin-detail__meta">จัดการแล้ว {placeholders.resolvedCount} รายการ</p> : null}
            </section>

            {detail.sections.map((section, index) => (
              <section aria-labelledby={`admin-detail-section-${index}`} className="admin-detail__card" key={section.title}>
                <h2 id={`admin-detail-section-${index}`} className="admin-detail__heading">
                  {section.title}
                </h2>
                <dl className="admin-detail__fields">
                  {section.fields.map((field) => (
                    <div className="admin-detail__field" key={field.label}>
                      <dt>
                        {field.label}
                        {field.placeholder ? <span className="admin-status admin-status--unknown admin-detail__flag">ข้อความตัวอย่าง</span> : null}
                      </dt>
                      <dd>
                        <FieldValue field={field} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <BackLink href={backHref} />
        </Container>
      </Section>
    </>
  );
}

export function ContentDetailMissing({ backHref }) {
  return (
    <>
      <PageHeader current="ไม่พบรายการ" eyebrow="ผู้ดูแลระบบ" title="ไม่พบรายการเนื้อหา" trail={TRAIL}>
        <BackLink href={backHref} />
      </PageHeader>
      <Section aria-labelledby="admin-detail-missing" className="admin-section">
        <Container>
          <div className="admin-panel admin-panel--notice">
            <h2 id="admin-detail-missing" className="admin-panel__title">
              ไม่พบรายการนี้
            </h2>
            <p className="admin-panel__text">ลิงก์ไม่ถูกต้อง หรือรายการนี้ไม่มีอยู่ในฐานข้อมูล กรุณากลับไปเลือกจากรายการเนื้อหา</p>
          </div>
        </Container>
      </Section>
    </>
  );
}
