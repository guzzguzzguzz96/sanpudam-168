export const siteConfig = {
  name: "Sanpudam 168",
  // Provisional Thai name; pending owner verification.
  localName: "ศาลปู่ดำ168 และตราแผ่นดิน",
  // Shows the site-wide prototype notice while content is unverified.
  isPreview: true,
  description:
    "พื้นที่ออนไลน์สำหรับ Sanpudam 168 กำลังอยู่ระหว่างการจัดเตรียม",
  // Contact actions render only when an owner-verified value is set here.
  // Values are validated in src/lib/contact-actions.js.
  // LINE: https://line.me/... or https://lin.ee/... inquiry link.
  lineInquiryUrl: null,
  // Google Maps link for directions (https://maps.app.goo.gl/... etc.).
  directionsUrl: null,
  // Phone number as displayed, e.g. "02-123-4567" or "+66 2 123 4567".
  phoneNumber: null,
  navigation: [
    { href: "/", label: "หน้าแรก" },
    { href: "/history", label: "ประวัติ" },
    { href: "/sakkara", label: "วัตถุมงคล" },
    { href: "/news", label: "ข่าวสาร" },
    { href: "/visit", label: "เยี่ยมชม" },
  ],
};
