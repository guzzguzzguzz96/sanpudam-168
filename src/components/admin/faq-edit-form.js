"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

// Owner-only FAQ edit form (question and answer). The server action checks
// access and validates everything again; the checks here are only hints.
// The preview uses the public FAQ markup and the same React text rendering
// (components/home/faq.js), never HTML.

const TRAIL = [{ href: "/admin", label: "ผู้ดูแลระบบ" }, { href: "/admin/content?type=faqs", label: "รายการเนื้อหา" }];

const FORM_MESSAGES = {
  forbidden: "บัญชีนี้ไม่มีสิทธิ์แก้ไข FAQ (เฉพาะเจ้าของเว็บไซต์) ยังไม่มีการบันทึกข้อมูล",
  not_found: "ไม่พบ FAQ นี้ ยังไม่มีการบันทึกข้อมูล",
  invalid_request: "ข้อมูลที่ส่งมาไม่ถูกต้อง ยังไม่มีการบันทึกข้อมูล กรุณาโหลดหน้านี้ใหม่แล้วลองอีกครั้ง",
  validation: "ยังไม่ได้บันทึก กรุณาแก้ไขข้อมูลที่ระบุไว้",
  unavailable: "ระบบบันทึกยังไม่พร้อมใช้งาน ยังไม่มีการเปลี่ยนแปลงข้อมูล",
  not_eligible: "FAQ นี้ไม่ได้อยู่ในสถานะฉบับร่างและรอตรวจทานแล้ว จึงแก้ไขจากหน้านี้ไม่ได้ ยังไม่มีการบันทึกข้อมูล",
  stale: "มีการแก้ไข FAQ นี้หลังจากที่คุณเปิดฟอร์ม ข้อความของคุณยังไม่ถูกบันทึก กรุณาคัดลอกข้อความไว้ แล้วโหลดหน้านี้ใหม่",
  failed: "บันทึกไม่สำเร็จ ยังไม่มีการเปลี่ยนแปลงข้อมูล กรุณาลองใหม่อีกครั้ง",
};

function fieldMessage(code, label, limit) {
  if (code === "required") return `กรุณากรอก${label}`;
  if (code === "too_long") return `${label}ยาวเกิน ${limit} ตัวอักษร`;
  if (code === "invalid_characters") return `${label}มีอักขระที่ใช้ไม่ได้`;
  if (code === "single_line") return `${label}ต้องอยู่ในบรรทัดเดียว`;
  return null;
}

function Field({ name, label, limit, value, onChange, rows, error, flagged }) {
  const id = `faq-${name}`;
  const message = fieldMessage(error, label, limit);
  return (
    <div className="admin-form__field">
      <label className="admin-form__label" htmlFor={id}>
        {label}
        {flagged ? <span className="admin-status admin-status--unknown">ยังเป็นข้อความตัวอย่าง</span> : null}
      </label>
      <textarea
        aria-describedby={`${id}-help${message ? ` ${id}-error` : ""}`}
        aria-invalid={message ? true : undefined}
        className="admin-form__input"
        id={id}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required
        rows={rows}
        value={value}
      />
      <p className={`admin-form__help${value.length > limit ? " admin-form__help--over" : ""}`} id={`${id}-help`}>
        {value.length}/{limit} ตัวอักษร
      </p>
      {message ? (
        <p className="admin-form__error" id={`${id}-error`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function FaqEditForm({ action, faq, labels, limits, detailHref }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const errors = state?.fieldErrors ?? {};
  const flagged = new Set(faq.openFlags.map((flag) => flag.field));

  return (
    <>
      <PageHeader current="แก้ไข" eyebrow="คำถามที่พบบ่อย" title="แก้ไข FAQ" trail={[...TRAIL, { href: detailHref, label: "รายละเอียด" }]}>
        <p className="admin-detail__back">
          <Link href={detailHref} prefetch={false}>
            ← กลับไปยังรายละเอียด
          </Link>
        </p>
      </PageHeader>
      <Section as="div" className="admin-section">
        <Container>
          <div className="admin-form-layout">
            <form action={formAction} className="admin-detail__card admin-form" noValidate>
              <p className="admin-panel__text">
                แก้ไขได้เฉพาะคำถามและคำตอบ สถานะ การแสดงบนหน้าแรก ลำดับ และข้อความตัวอย่างที่บันทึกไว้จะไม่เปลี่ยน
              </p>
              {state?.code ? (
                <p className="admin-panel__alert" role="alert">
                  {FORM_MESSAGES[state.code] ?? FORM_MESSAGES.failed}
                </p>
              ) : null}
              {faq.openFlags.length ? (
                <div className="admin-form__flags" role="note">
                  <p>ข้อความต่อไปนี้ยังมีสถานะข้อความตัวอย่าง การบันทึกจะไม่เปลี่ยนสถานะนี้:</p>
                  <ul>
                    {faq.openFlags.map((flag) => (
                      <li key={flag.field}>
                        {flag.label}
                        {flag.note ? ` (${flag.note})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <input name="version" type="hidden" value={faq.version} />
              <Field error={errors.question} flagged={flagged.has("question")} label={labels.question} limit={limits.question} name="question" onChange={setQuestion} rows={2} value={question} />
              <Field error={errors.answer} flagged={flagged.has("answer")} label={labels.answer} limit={limits.answer} name="answer" onChange={setAnswer} rows={7} value={answer} />
              <div className="admin-panel__actions">
                <Button disabled={pending} type="submit" variant="primary">
                  {pending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
                </Button>
                <Button href={detailHref} variant="outline">
                  ยกเลิก
                </Button>
              </div>
            </form>

            <section aria-labelledby="faq-preview-title" className="admin-detail__card">
              <h2 id="faq-preview-title" className="admin-detail__heading">
                ตัวอย่างการแสดงผล
              </h2>
              <p className="admin-panel__text">แสดงแบบเดียวกับส่วนคำถามที่พบบ่อยบนเว็บไซต์ ยังไม่ได้บันทึกจนกว่าจะกดบันทึก</p>
              <div className="home-faq__list admin-form__preview">
                <details className="home-faq__item" open>
                  <summary>{question.trim() || `(ยังไม่มี${labels.question})`}</summary>
                  <div className="home-faq__answer">
                    <p>{answer.trim() || `(ยังไม่มี${labels.answer})`}</p>
                  </div>
                </details>
              </div>
            </section>
          </div>
        </Container>
      </Section>
    </>
  );
}

const NOTICES = {
  forbidden: { title: "ไม่มีสิทธิ์แก้ไข FAQ", text: "การแก้ไข FAQ ในขั้นนี้เปิดให้เฉพาะบัญชีที่มีบทบาทเจ้าของเว็บไซต์ ยังดูรายละเอียดได้ตามปกติ" },
  unavailable: { title: "ระบบบันทึกยังไม่พร้อมใช้งาน", text: "ยังตั้งค่าการเชื่อมต่อสำหรับบันทึกข้อมูลไม่ครบ จึงยังเปิดฟอร์มแก้ไขไม่ได้ ไม่มีการเปลี่ยนแปลงข้อมูล" },
  environment: { title: "แก้ไขไม่ได้ในสภาพแวดล้อมนี้", text: "การแก้ไขเนื้อหาทดสอบเปิดใช้เฉพาะเครื่องพัฒนาและเว็บไซต์ตรวจทานของสาขา dev" },
  not_eligible: { title: "FAQ นี้แก้ไขจากหน้านี้ไม่ได้", text: "แก้ไขได้เฉพาะ FAQ ที่เป็นฉบับร่างและรอตรวจทาน" },
};

export function FaqEditNotice({ kind, backHref }) {
  const notice = NOTICES[kind] ?? NOTICES.unavailable;
  return (
    <>
      <PageHeader current="แก้ไข" eyebrow="คำถามที่พบบ่อย" title="แก้ไข FAQ" trail={TRAIL} />
      <Section aria-labelledby="faq-edit-notice" className="admin-section">
        <Container>
          <div className="admin-panel admin-panel--notice">
            <h2 id="faq-edit-notice" className="admin-panel__title">
              {notice.title}
            </h2>
            <p className="admin-panel__text">{notice.text}</p>
            <p className="admin-detail__back">
              <Link href={backHref} prefetch={false}>
                ← กลับไปยังรายละเอียด
              </Link>
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
