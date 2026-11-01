import { siteConfig } from "@/config/site";
import { getContactActions } from "@/lib/contact-actions";

const verifiedContacts = Object.fromEntries(
  getContactActions(["line", "maps"]).map((action) => [action.id, action]),
);

const previewCategory = { id: "preview-category", label: "หมวดหมู่รอการยืนยัน" };

export const homepagePreviewData = {
  banner: {
    eyebrow: siteConfig.name,
    title: siteConfig.localName,
    description:
      "พื้นที่ตัวอย่างสำหรับข้อความแนะนำ เนื้อหาจริงจะเผยแพร่หลังเจ้าของตรวจสอบและอนุมัติ",
    // In-page anchors until the /sakkara and /history routes exist.
    primaryCta: { href: "#featured-items", label: "ชมวัตถุมงคลแนะนำ" },
    secondaryCta: { href: "#about", label: "ทำความรู้จักศาล" },
    desktopImage: null,
    mobileImage: null,
    desktopFocalPoint: "50% 50%",
    mobileFocalPoint: "50% 50%",
  },
  quickInformation: [
    {
      id: "hours",
      icon: "clock",
      label: "เวลาเปิดทำการ",
      value: "รอข้อมูลยืนยัน",
    },
    { id: "location", icon: "mapPin", label: "สถานที่", value: "รอข้อมูลยืนยัน" },
    {
      id: "contact",
      icon: "chat",
      label: "ช่องทางติดต่อ",
      value: "รอข้อมูลยืนยัน",
    },
  ],
  // Only working actions: in-page anchors, plus external contact
  // destinations once the owner has verified them in siteConfig.
  quickActions: [
    { id: "history", href: "#about", icon: "book", label: "ประวัติศาล" },
    {
      id: "worship",
      href: "#worship-guide",
      icon: "lotus",
      label: "การสักการะ",
    },
    {
      id: "sacred-items",
      href: "#featured-items",
      icon: "gem",
      label: "วัตถุมงคล",
    },
    verifiedContacts.maps
      ? {
          id: "directions",
          href: verifiedContacts.maps.href,
          icon: "route",
          label: "นำทางไปศาล",
          external: true,
        }
      : { id: "directions", href: "#visit", icon: "route", label: "การเดินทาง" },
    verifiedContacts.line
      ? {
          id: "line",
          href: verifiedContacts.line.href,
          icon: "chat",
          label: "สอบถามทาง LINE",
          external: true,
        }
      : null,
  ].filter(Boolean),
  about: {
    title: "ข้อมูลเกี่ยวกับ Sanpudam 168",
    description:
      "ส่วนนี้เตรียมไว้สำหรับประวัติและความสำคัญ ซึ่งจะเพิ่มหลังได้รับข้อมูลที่เจ้าของตรวจสอบและอนุมัติแล้ว",
    image: null,
    imageAlt: "",
    href: "/history",
  },
  // Placeholder records in the normalized shape (src/lib/sacred-items.js).
  // No prices, stock, or availability.
  featuredItems: {
    // The catalog route exists (C2.1); it lists published items only.
    catalogHref: "/sakkara",
    items: [
      {
        id: "preview-item-01",
        name: "ชื่อรายการรอการยืนยัน",
        summary: "พื้นที่สำหรับคำอธิบายรายการที่ผ่านการตรวจสอบ",
        category: previewCategory,
        image: null,
        href: null,
      },
      {
        id: "preview-item-02",
        name: "ชื่อรายการรอการยืนยัน",
        summary: "พื้นที่สำหรับคำอธิบายรายการที่ผ่านการตรวจสอบ",
        category: previewCategory,
        image: null,
        href: null,
      },
      {
        id: "preview-item-03",
        name: "ชื่อรายการรอการยืนยัน",
        summary: "พื้นที่สำหรับคำอธิบายรายการที่ผ่านการตรวจสอบ",
        category: previewCategory,
        image: null,
        href: null,
      },
    ],
  },
  worshipGuide: [
    {
      id: "preview-step-01",
      title: "หัวข้อคำแนะนำรอการอนุมัติ",
      description: "ยังไม่มีคำแนะนำการสักการะที่ได้รับการยืนยัน",
    },
    {
      id: "preview-step-02",
      title: "หัวข้อคำแนะนำรอการอนุมัติ",
      description: "ยังไม่มีคำแนะนำการสักการะที่ได้รับการยืนยัน",
    },
    {
      id: "preview-step-03",
      title: "หัวข้อคำแนะนำรอการอนุมัติ",
      description: "ยังไม่มีคำแนะนำการสักการะที่ได้รับการยืนยัน",
    },
  ],
  news: [
    {
      id: "preview-news-01",
      title: "หัวข้อข่าวสารรอการยืนยัน",
      publicationDate: null,
      description: "พื้นที่สำหรับข่าวสารที่ผ่านการตรวจสอบและอนุมัติ",
      image: null,
      href: null,
    },
    {
      id: "preview-news-02",
      title: "หัวข้อข่าวสารรอการยืนยัน",
      publicationDate: null,
      description: "พื้นที่สำหรับข่าวสารที่ผ่านการตรวจสอบและอนุมัติ",
      image: null,
      href: null,
    },
    {
      id: "preview-news-03",
      title: "หัวข้อข่าวสารรอการยืนยัน",
      publicationDate: null,
      description: "พื้นที่สำหรับข่าวสารที่ผ่านการตรวจสอบและอนุมัติ",
      image: null,
      href: null,
    },
  ],
  gallery: [
    {
      id: "preview-gallery-01",
      label: "พื้นที่สำหรับภาพที่ได้รับอนุมัติ 01",
      image: null,
      alt: "",
      layout: "home-gallery__item--feature",
    },
    {
      id: "preview-gallery-02",
      label: "พื้นที่สำหรับภาพที่ได้รับอนุมัติ 02",
      image: null,
      alt: "",
      layout: "",
    },
    {
      id: "preview-gallery-03",
      label: "พื้นที่สำหรับภาพที่ได้รับอนุมัติ 03",
      image: null,
      alt: "",
      layout: "",
    },
    {
      id: "preview-gallery-04",
      label: "พื้นที่สำหรับภาพที่ได้รับอนุมัติ 04",
      image: null,
      alt: "",
      layout: "",
    },
    {
      id: "preview-gallery-05",
      label: "พื้นที่สำหรับภาพที่ได้รับอนุมัติ 05",
      image: null,
      alt: "",
      layout: "",
    },
  ],
  // Ordered by visitor priority: hours, location, then contact.
  visit: [
    { id: "hours", icon: "clock", label: "เวลาเปิดทำการ", value: "รอข้อมูลยืนยัน" },
    { id: "address", icon: "mapPin", label: "สถานที่", value: "รอข้อมูลยืนยัน" },
    { id: "contact", icon: "chat", label: "ช่องทางติดต่อ", value: "รอข้อมูลยืนยัน" },
  ],
  faq: [
    {
      id: "preview-question-01",
      question: "ตัวอย่างคำถามที่รอการตรวจสอบและอนุมัติ",
      answer: "คำตอบจะแสดงเมื่อได้รับข้อมูลที่เจ้าของตรวจสอบแล้ว",
    },
    {
      id: "preview-question-02",
      question: "ตัวอย่างคำถามที่รอการตรวจสอบและอนุมัติ",
      answer: "คำตอบจะแสดงเมื่อได้รับข้อมูลที่เจ้าของตรวจสอบแล้ว",
    },
    {
      id: "preview-question-03",
      question: "ตัวอย่างคำถามที่รอการตรวจสอบและอนุมัติ",
      answer: "คำตอบจะแสดงเมื่อได้รับข้อมูลที่เจ้าของตรวจสอบแล้ว",
    },
  ],
};
