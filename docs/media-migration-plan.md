# แผนการย้ายสื่อและเนื้อหา (Media Migration Plan)

**Phase:** 02.5.1 — Reference Website Asset Discovery (แผนสำหรับเฟสถัดไป)
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**สถานะ:** ข้อเสนอเพื่อขออนุมัติ ยังไม่มีการเชื่อมต่อ MongoDB ไม่มีการอัปโหลดไป Cloudinary ไม่มีการดาวน์โหลดไฟล์เพื่อนำไปใช้ และยังไม่มีโค้ดนำเข้า

เอกสารที่เกี่ยวข้อง: [`reference-media-inventory.md`](reference-media-inventory.md), [`reference-content-inventory.md`](reference-content-inventory.md), [`reference-media-manifest.json`](reference-media-manifest.json), [`information-architecture.md`](information-architecture.md)

## 1. เป้าหมายและหลักการ

1. **ไฟล์สื่ออยู่ใน Cloudinary ส่วนข้อมูลอ้างอิงและ metadata อยู่ใน MongoDB** ส่วนแสดงผลอ้างอิงสื่อด้วย ID เท่านั้น
2. **หนึ่งไฟล์ต้นฉบับ = หนึ่ง asset** ภาพที่ใช้หลายตำแหน่ง (เช่น ภาพองค์ปู่ดำใช้ 26 ครั้งใน 10 หน้า) เก็บครั้งเดียว ขนาดย่อและการครอปสร้างผ่าน Cloudinary transformation และ `next/image` ไม่อัปโหลดไฟล์อนุพันธ์
3. **ทุกขั้นที่มีผลภายนอกต้องได้รับอนุมัติก่อน** และทุกการรันต้องมีโหมด dry-run
4. **ทำซ้ำได้โดยไม่เกิดข้อมูลซ้ำ** (idempotent) และ **ไม่เขียนทับหรือลบของเดิม**
5. **เนื้อหาที่นำเข้าเป็น draft เสมอ** จนกว่าเจ้าของจะยืนยัน
6. **ใช้ stack เดิมของโปรเจกต์** ตามที่ README และ IA วางไว้ (Next.js, MongoDB Atlas + Mongoose, Cloudinary) ไม่เพิ่ม dependency ที่ไม่จำเป็น

## 2. โครงสร้างโฟลเดอร์ Cloudinary

จัดตาม **เจ้าของและเรื่องของภาพ (subject)** ไม่จัดตามหน้าที่ภาพไปปรากฏ เพราะภาพเดียวถูกใช้หลายหน้า และการย้ายโฟลเดอร์ภายหลังจะทำให้ public ID เปลี่ยน ความสัมพันธ์กับหน้า ข่าว หรือรายการเก็บใน MongoDB

```text
sanpudam168/                          ← โฟลเดอร์รากของโปรเจกต์
├── brand/                            ← โลโก้ ภาพแชร์เริ่มต้น
├── shrine/
│   ├── sacred-objects/               ← องค์ปู่ดำ ตราแผ่นดิน รูปเหมือน
│   ├── interior/                     ← โถงภายในศาล
│   ├── exterior/                     ← ซุ้มประตู ป้าย อาคาร
│   ├── surroundings/                 ← สถานที่ใกล้เคียง เส้นทาง
│   └── devotees/                     ← ภาพบรรยากาศที่มีบุคคล (ต้องมีความยินยอม)
├── sacred-items/
│   └── <item-slug>/                  ← ภาพของวัตถุมงคลแต่ละรายการ
├── events/                           ← ภาพจากงานพิธีและกิจกรรม
├── editorial/
│   └── infographics/                 ← อินโฟกราฟิกและภาพประกอบบทความ
└── pages/                            ← ภาพเฉพาะหน้า ที่ไม่ใช่ภาพของสถานที่หรือรายการ
```

กติกา:

- **public ID** มาจาก manifest ตายตัว (เช่น `sanpudam168/shrine/sacred-objects/pu-dam-168-statue`) ใช้ตัวพิมพ์เล็ก ภาษาอังกฤษ และขีดกลาง ไม่ใส่ขนาดหรือชื่อหน้าลงใน ID
- ภาพกิจกรรมอยู่ในโฟลเดอร์ `events/` เดียว ใช้วันที่นำหน้าชื่อเมื่อทราบวันที่ (`2569-03-16-…`) ความสัมพันธ์กับข่าวเก็บใน MongoDB
- ระบุพารามิเตอร์ตอนอัปโหลด: `overwrite=false`, `unique_filename=false`, `use_filename=false`, `invalidate=false`, `resource_type=image`
- เก็บ context metadata: `alt` (ค่าหลัก), `source_url` และ tag `source:reference-site`, `rights:pending`, `phase:02.5` เพื่อค้นหาและตรวจย้อนหลัง
- โฟลเดอร์รากควรตั้งค่าได้ (เช่น `sanpudam168` สำหรับ production และ `sanpudam168-staging` สำหรับทดสอบ) เพื่อไม่ให้การทดสอบปะปนกับข้อมูลจริง

### Asset model ที่ใช้ซ้ำได้

ทุกประเภทใช้ `media_assets` แบบเดียวกัน ต่างกันที่ฟิลด์ `category`:

| ประเภทการใช้งาน | `category` | โฟลเดอร์ |
|---|---|---|
| Banner images | ใช้ asset ของสถานที่ (`shrine-place`) หรือ `banner` ถ้าเป็นภาพทำขึ้นเฉพาะ | `shrine/…` หรือ `pages/` |
| Sacred item images | `sacred-item`, `shrine-sacred-object` | `sacred-items/<slug>/`, `shrine/sacred-objects/` |
| News covers / News galleries | `event`, `editorial` | `events/`, `editorial/` |
| Shrine gallery | `shrine-place`, `shrine-people`, `event` | `shrine/…`, `events/` |
| Page images | `page` | `pages/` |
| Branding assets | `branding` | `brand/` |

ตำแหน่งที่ใช้ภาพ (ปก แกลเลอรี สไลด์) อ้างอิง asset ผ่าน **image reference** ที่กำหนด alt, caption และจุดโฟกัสเฉพาะตำแหน่งได้:

```js
// Image reference ใช้ใน banners, sacred_items, news, galleries, pages
{
  assetId: ObjectId,          // → media_assets._id
  alt: String | null,         // override เฉพาะตำแหน่ง; null = ใช้ alt หลักของ asset
  caption: String | null,
  focalPoint: { x: Number, y: Number } | null,   // 0–1, override ค่าเริ่มต้นของ asset
  crop: { aspectRatio: String } | null,          // เช่น "1:1", "16:9"
}
```

## 3. โครงสร้าง MongoDB ที่เสนอ

ทุก collection มีฟิลด์มาตรฐาน: `status` (`draft` | `published` | `archived`), `verification` (`pending_owner` | `verified`), `createdAt`, `updatedAt` และ `migration` (`{ sourceKey, sourceUrl, runId, importedAt }`) สำหรับเรคอร์ดที่มาจากการนำเข้า

### 3.1 `media_assets`

```js
{
  _id: ObjectId,
  manifestId: String,                 // เช่น "shrine-pu-dam-168-statue" (unique)
  category: String,                   // branding | shrine-place | shrine-sacred-object | sacred-item | event | editorial | shrine-people | page
  cloudinary: {
    publicId: String,                 // unique
    secureUrl: String,
    version: Number,
    format: String,                   // webp | png | jpg
    resourceType: "image",
    etag: String,                     // MD5 ที่ Cloudinary คืนมา ใช้ตรวจความถูกต้อง
  },
  width: Number,
  height: Number,
  bytes: Number,
  mimeType: String,
  contentHash: { sha256: String, md5: String, dhash: String },
  alt: String,                        // alt หลัก (ภาษาไทย)
  altCandidates: [String],            // alt ทั้งหมดที่พบจากต้นทาง
  caption: String | null,
  focalPoint: { x: Number, y: Number } | null,
  source: {
    type: "reference-site" | "owner-upload",
    url: String | null,               // URL ต้นทาง (unique, sparse)
    originalFilename: String,
    pages: [String],                  // หน้าที่พบบนเว็บอ้างอิง
  },
  rights: {
    status: "pending_owner_confirmation" | "approved" | "restricted" | "rejected",
    owner: String | null,             // ผู้ถ่ายภาพ/ผู้ถือสิทธิ์
    license: String | null,
    containsIdentifiablePeople: Boolean,
    consentStatus: "not_required" | "pending" | "obtained" | "refused",
    notes: [String],
  },
  approval: { status: "pending" | "approved" | "rejected", approvedBy: String | null, approvedAt: Date | null },
  importedAt: Date,
  migration: { runId: String, manifestSchemaVersion: Number },
  createdAt: Date,
  updatedAt: Date,
}
```

Index: unique `manifestId`, unique `cloudinary.publicId`, unique `contentHash.sha256`, unique sparse `source.url`, และ `{ category: 1, "rights.status": 1 }`

### 3.2 `banners`

```js
{
  key: "home-hero",                   // unique
  title: String, subtitle: String | null, locationLine: String | null,
  slides: [{ image: ImageRef, mobileImage: ImageRef | null, caption: String | null, order: Number }],
  primaryCta: { label: String, href: String } | null,
  secondaryCta: { label: String, href: String } | null,
  publishWindow: { start: Date | null, end: Date | null },
  status, verification, migration,
}
```

ระบบใหม่แสดงแบนเนอร์แบบภาพนิ่ง (ไม่ autoplay) จึงใช้สไลด์ลำดับแรกเป็นภาพหลัก

### 3.3 `sacred_items`

```js
{
  slug: String,                       // unique, ตรงกับ /sakkara/[slug]
  kind: "worship_point" | "sacred_object" | "check_in_spot",
  name: String,
  categoryKey: String,                // → site_settings.taxonomies.sacredItemCategories[].key
  summary: String,
  body: [Block],                      // ย่อหน้า/หัวข้อ
  images: [ImageRef],
  facts: [{ label: String, value: String, verified: Boolean }],      // เช่น "นิยมขอพรเรื่อง", "ของไหว้ที่นิยม"
  editions: [{ material: String, quantity: Number, verified: Boolean }] | null,   // ซ่อนจนกว่า verified
  inquiry: { channel: "line" | null, note: String | null },         // ไม่มีราคา ตะกร้า หรือการชำระเงิน
  featured: Boolean, order: Number,
  placeholderNotes: [String],         // ข้อความ "ตัวอย่าง/รอ…" ที่พบจากต้นทาง
  status, verification, migration,
}
```

ไม่มีฟิลด์ราคา สต็อก หรือสถานะคงเหลือ ตาม IA

### 3.4 `news`

```js
{
  slug: String,                       // unique
  title: String, excerpt: String,
  body: [Block],
  coverImage: ImageRef,
  gallery: [ImageRef],
  publishedAt: Date,                  // ISO; แสดงผลเป็น พ.ศ.
  eventDate: Date | null,             // แยกจากวันที่เผยแพร่
  author: { type: "organization", name: String },
  people: [{ name: String, title: String, verified: Boolean }],   // บุคคลที่ถูกกล่าวถึง
  placeholderNotes: [String],
  status, verification, migration,
}
```

### 3.5 `galleries`

```js
{
  key: "shrine-main",                 // unique
  title: String, description: String | null,
  items: [{ image: ImageRef, order: Number }],
  status, verification, migration,
}
```

ส่วน "บรรยากาศแห่งศรัทธา" ในหน้าแรกอ้างอิงแกลเลอรีนี้และกำหนดจำนวนที่แสดง ไม่สร้างแกลเลอรีซ้ำ

### 3.6 `pages`

```js
{
  key: "home" | "history" | "visit",  // unique
  title: String, intro: String | null,
  sections: [{ key: String, type: String, heading: String | null, body: [Block], images: [ImageRef], items: [Object] }],
  faq: [{ question: String, answer: String, order: Number, verified: Boolean }],
  seo: { title: String | null, description: String | null, ogImage: ImageRef | null },
  status, verification, migration,
}
```

### 3.7 `site_settings`

เอกสารเดียว (`key: "default"`):

```js
{
  key: "default",
  name: String, alternateName: String | null, description: String | null,
  branding: { logoAssetId: ObjectId | null, faviconAssetId: ObjectId | null },
  contact: {
    lineInquiryUrl: String | null,    // ชื่อฟิลด์ตรงกับ src/config/site.js
    directionsUrl: String | null,
    phoneNumber: String | null,
    address: String | null,
    verified: Boolean,
  },
  openingHours: [{ days: [String], opens: String, closes: String }],
  social: [{ platform: String, url: String, verified: Boolean }],
  taxonomies: { sacredItemCategories: [{ key: String, label: String, order: Number }] },
  seo: { defaultTitle: String | null, defaultDescription: String | null, defaultOgImageAssetId: ObjectId | null },
  status, verification, migration,
}
```

ชื่อฟิลด์ติดต่อใช้ชื่อเดียวกับ `src/config/site.js` และผ่านการตรวจรูปแบบด้วย `src/lib/contact-actions.js` เดิม เพื่อไม่ให้มีฟิลด์ซ้ำสำหรับปลายทางเดียวกัน

## 4. ขั้นตอนการนำเข้าที่ทำซ้ำได้

### 4.1 ภาพรวม

```text
[0] สำรวจ (เสร็จแล้วในเฟสนี้) → reference-media-manifest.json
      ↓
[1] เจ้าของตรวจสิทธิ์และอนุมัติรายไฟล์ (approval.status = "approved" ใน manifest หรือไฟล์อนุมัติแยก)
      ↓
[2] dry-run แบบออฟไลน์ (ไม่ใช้ credentials): ตรวจ manifest, ดึงไฟล์ต้นทางในหน่วยความจำ, เทียบ SHA-256 กับ manifest, สร้างรายงานแผน
      ↓
[3] dry-run แบบเชื่อมต่อ (อ่านอย่างเดียว): ตรวจว่า public ID มีอยู่ใน Cloudinary แล้วหรือไม่ และมีเรคอร์ดใน MongoDB แล้วหรือไม่
      ↓
[4] ผู้ดูแลอนุมัติแผน: รันด้วย --apply --plan-hash=<ค่าจาก dry-run> (ถ้าแผนเปลี่ยน ค่า hash ไม่ตรง ระบบจะปฏิเสธ)
      ↓
[5] อัปโหลดสื่อ → upsert media_assets
      ↓
[6] นำเข้าเนื้อหาเป็น draft (site_settings, sacred_items, news, galleries, pages, banners)
      ↓
[7] รายงานผลและตรวจสอบ
```

### 4.2 รายละเอียดแต่ละขั้น

**อนุมัติแบบชัดเจน**

- ค่าเริ่มต้นของสคริปต์คือ dry-run เสมอ การเขียนจริงต้องมีทั้ง `--apply` และ `--plan-hash` ที่ตรงกับผลของ dry-run ล่าสุด
- นำเข้าเฉพาะไฟล์ที่ `approval.status === "approved"` และ `rights.status === "approved"` ไฟล์อื่นถูกข้ามและบันทึกเหตุผลไว้

**การตรวจความถูกต้องและกันข้อมูลซ้ำ**

- ก่อนอัปโหลด ดึงไฟล์ต้นทางในหน่วยความจำแล้วเทียบ SHA-256 กับ manifest หากต่างกัน (เว็บอ้างอิงเปลี่ยนภาพ) ให้หยุดรายการนั้นและขอให้ตรวจใหม่
- อัปโหลดด้วย Cloudinary Upload API แบบระบุ URL ต้นทาง (Cloudinary ดึงไฟล์เอง ไม่ต้องเก็บไฟล์ในเครื่อง) พร้อม public ID ตายตัวและ `overwrite=false`
- หลังอัปโหลด เทียบ `etag` (MD5) ที่ Cloudinary คืนมากับ MD5 ที่คำนวณไว้
- ถ้า public ID มีอยู่แล้วและ MD5 ตรงกัน: ถือว่านำเข้าแล้ว ข้ามได้ ถ้า MD5 ไม่ตรง: **ขัดแย้ง** หยุดรายการนั้น ไม่เขียนทับ และรายงานให้ตัดสินใจ
- MongoDB ใช้ `updateOne({ "contentHash.sha256": … }, { $setOnInsert: … }, { upsert: true })` จึงไม่สร้างซ้ำและไม่ทับข้อมูลที่ผู้ดูแลแก้ไขภายหลัง ส่วนเนื้อหาใช้ `migration.sourceKey` (เช่น `reference:/sakkara/pu-dam-168`) เป็นคีย์ upsert ในลักษณะเดียวกัน

**การจัดการข้อผิดพลาดและการลองใหม่**

- แยกข้อผิดพลาดชั่วคราว (network, HTTP 429/5xx) กับข้อผิดพลาดถาวร (4xx อื่นๆ, hash ไม่ตรง, ข้อขัดแย้ง)
- ข้อผิดพลาดชั่วคราว: retry สูงสุด 3 ครั้งแบบ exponential backoff (2, 4, 8 วินาที) และเคารพ `Retry-After`
- หนึ่งรายการล้มเหลวไม่ทำให้ทั้งการรันหยุด สถานะแต่ละรายการถูกบันทึก การรันครั้งถัดไปทำต่อเฉพาะรายการที่ยังไม่สำเร็จ (resume)
- ทำทีละรายการและเว้นระยะคำขอ เพื่อไม่ให้เกิดภาระกับเว็บต้นทางและไม่ชน rate limit ของ Cloudinary

**Log ที่ไม่มีความลับ**

- เขียน log แบบ JSON Lines ลงโฟลเดอร์ที่อยู่ใน `.gitignore` (เช่น `.migration-logs/<runId>.jsonl`) เก็บ `runId`, เวลา, `manifestId`, ขั้นตอน, ผลลัพธ์, public ID และข้อความผิดพลาดที่ตัดความลับออกแล้ว
- ห้ามบันทึกค่าใน `.env.local`, `MONGODB_URI`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AUTH_SECRET`, ลายเซ็นของคำขอ หรือ response แบบเต็ม
- สรุปผลท้ายการรัน: จำนวนนำเข้า ข้าม ขัดแย้ง และล้มเหลว

**ไม่ทำลายข้อมูล**

- สคริปต์นำเข้าไม่มีคำสั่งลบหรือเปลี่ยนชื่อใน Cloudinary และ MongoDB
- ไม่ใช้ `overwrite=true` ไม่ใช้ `replaceOne` และไม่ใช้ `$set` กับเอกสารที่มีอยู่แล้ว
- ควรใช้ Cloudinary API key ที่จำกัดสิทธิ์เท่าที่จำเป็น (ถ้าบัญชีรองรับ)

**สถานะ draft และการจับคู่ CMS**

- ทุกเรคอร์ดเนื้อหานำเข้าด้วย `status: "draft"` และ `verification: "pending_owner"`
- ย่อหน้าต้นทางที่มีข้อความ "ตัวอย่าง" หรือ "รอ…" (ดู content inventory ข้อ 9) ถูกแยกไปไว้ที่ `placeholderNotes` ไม่นำเข้าเป็นเนื้อหา
- ข้อมูลติดต่อนำเข้า `site_settings.contact` โดย `verified: false` ส่วนหน้าเว็บยังใช้ค่าใน `src/config/site.js` (ซึ่งเป็น `null`) จนกว่าจะเปลี่ยนแหล่งข้อมูลอย่างเป็นทางการ

| โมดูล CMS ในอนาคต (`information-architecture.md`) | collection |
|---|---|
| Banner | `banners` |
| Site Settings | `site_settings` |
| Page Content | `pages` |
| Sacred Items | `sacred_items` (+ หมวดหมู่ใน `site_settings.taxonomies`) |
| News | `news` |
| Gallery | `galleries` |
| FAQ | `pages[*].faq` (แยก collection ได้ภายหลัง) |
| (ใช้ร่วมทุกโมดูล) | `media_assets` |

### 4.3 ตำแหน่งโค้ดและ dependency (สำหรับเฟส implementation)

| ส่วน | ตำแหน่งที่เสนอ |
|---|---|
| Mongoose schemas | `src/models/media-asset.js`, `banner.js`, `sacred-item.js`, `news.js`, `gallery.js`, `page.js`, `site-settings.js` |
| บริการ Cloudinary (อัปโหลด ลายเซ็น และสร้าง URL) | `src/services/media/cloudinary.js` (server-only) |
| บริการเชื่อมต่อฐานข้อมูล | `src/lib/db.js` (server-only, connection caching) |
| สคริปต์นำเข้า | `scripts/migration/import-reference-media.mjs` และ `import-reference-content.mjs` รันด้วย `node --env-file=.env.local …` |
| manifest | `docs/reference-media-manifest.json` (อ่านอย่างเดียวสำหรับสคริปต์) |

Dependency: **`mongoose`** ตัวเดียว ซึ่งอยู่ในแผนสถาปัตยกรรมเดิมแล้ว ส่วน Cloudinary ใช้ REST API ด้วย `fetch` และ `node:crypto` ที่มีอยู่ใน Node.js (สร้างลายเซ็น SHA-1 ตามเอกสาร Cloudinary) จึงไม่ต้องเพิ่ม Cloudinary SDK การวัดมิติและ hash ใช้ `sharp` ที่ติดตั้งมากับ Next.js อยู่แล้ว เมื่อจะแสดงภาพผ่าน `next/image` ต้องเพิ่ม `images.remotePatterns` สำหรับ `res.cloudinary.com` ใน `next.config.mjs`

ปริมาณข้อมูลรอบแรก: ไฟล์ต้นฉบับ 17 ไฟล์ รวมประมาณ 4.0 MB (ไฟล์อนุพันธ์ 17 ไฟล์ รวม 1.6 MB ไม่นำเข้า)

## 5. ความเสี่ยงของการย้ายข้อมูล

| # | ความเสี่ยง | ผลกระทบ | แนวทางลดความเสี่ยง |
|---:|---|---|---|
| 1 | ยังไม่ทราบผู้ถือสิทธิ์ของภาพทั้ง 17 ไฟล์ | ละเมิดลิขสิทธิ์ | นำเข้าเฉพาะไฟล์ที่เจ้าของอนุมัติรายไฟล์ |
| 2 | ภาพบุคคลที่ระบุตัวตนได้ 7 ไฟล์ (เจ้าหน้าที่ พระสงฆ์ ผู้ศรัทธา) | ประเด็น PDPA และความยินยอม | ฟิลด์ `consentStatus` และไม่เผยแพร่จนกว่าจะได้ความยินยอม |
| 3 | ภาพตราแผ่นดินและเครื่องหมายราชการ รวมถึงการแสดงคู่กับวัตถุมงคล | ข้อกฎหมายเรื่องเครื่องหมายราชการ | ขอความเห็นทางกฎหมายก่อนเผยแพร่ |
| 4 | โลโก้มีเพียง PNG 192×192 px | ภาพแตกเมื่อแสดงขนาดใหญ่ | ขอไฟล์ต้นฉบับหรือเวกเตอร์ ห้ามวาดโลโก้ใหม่เอง |
| 5 | ภาพที่มีข้อความในภาพ (โปสเตอร์เหรียญ อินโฟกราฟิก จดหมายข่าว) | แก้ไขผ่าน CMS ไม่ได้, ผู้ใช้โปรแกรมอ่านหน้าจออ่านไม่ได้, ตัวเลขจัดสร้างแสดงโดยไม่ได้ยืนยัน | ต้องมีข้อความเทียบเท่าใน HTML และตรวจทานข้อความในภาพ |
| 6 | เว็บอ้างอิงมีย่อหน้า placeholder ปะปนกับเนื้อหาจริง | ข้อความตัวอย่างถูกเผยแพร่เป็นข้อเท็จจริง | แยกไปที่ `placeholderNotes` และนำเข้าเป็น draft |
| 7 | ลิงก์แผนที่เป็น `share.google/…` ซึ่ง `getMapsUrl()` ใน `src/lib/contact-actions.js` ไม่ยอมรับ | ปุ่มนำทางไม่แสดงแม้เจ้าของยืนยันแล้ว | ขอลิงก์ `maps.app.goo.gl` หรือ `google.com/maps` จากเจ้าของ หรือทบทวน allowlist หลังยืนยันว่าโดเมนนี้เปิดไปที่ Google Maps จริง |
| 8 | บัญชีโซเชียลมีชื่อไม่ตรงกับชื่อศาล | ลิงก์ไปบัญชีที่ไม่ใช่ของศาล | ให้เจ้าของยืนยันทุกบัญชี |
| 9 | เว็บอ้างอิงรวมสิ่งที่กราบไหว้และวัตถุมงคลไว้รายการเดียว | โมเดลข้อมูลไม่ตรงกับ IA | ใช้ฟิลด์ `kind` และตัดสินใจเรื่องการแสดงผลร่วมกับเจ้าของ |
| 10 | แบนเนอร์ต้นทางเป็น autoplay carousel 4 ภาพ | ขัดกับ design system | ใช้ภาพนิ่ง ส่วนภาพอื่นอยู่ในแกลเลอรี |
| 11 | เว็บอ้างอิงอาจเปลี่ยนหรือปิดตัว | URL ต้นทางใช้ไม่ได้หรือไฟล์เปลี่ยน | ตรวจ SHA-256 ก่อนนำเข้า หากต้นทางหายให้ขอไฟล์จากเจ้าของ |
| 12 | `dateModified` ของข่าวเป็นเวลา build ไม่ใช่วันแก้ไขจริง | ข้อมูลวันที่ผิด | ไม่นำเข้า `dateModified` เก็บ `publishedAt` แบบ ISO แล้วแสดงผลเป็น พ.ศ. |
| 13 | ภาพเดียวใช้ alt ต่างกันหลายแบบ | alt ไม่สม่ำเสมอ | เก็บ alt หลักหนึ่งค่า และ override ได้ที่ image reference |
| 14 | ข้อความเชิงความเชื่อ ชื่อเจ้าหน้าที่ และการอ้างถึง สน.พระราชวัง | ความถูกต้องและความเหมาะสม | `verification: pending_owner` และเจ้าของตรวจทานก่อนเผยแพร่ |
| 15 | เมื่อเว็บใหม่เปิดใช้งาน เนื้อหาจะซ้ำกับเว็บอ้างอิงที่ยังเปิดอยู่ | ปัญหา SEO (duplicate content) | เจ้าของตัดสินใจเรื่อง canonical, redirect หรือปิดเว็บอ้างอิง |
| 16 | ข้อมูลติดต่อจริงกับค่าใน `src/config/site.js` อาจไม่ตรงกันระหว่างช่วงเปลี่ยนผ่าน | แสดงข้อมูลไม่ตรงกัน | ใช้แหล่งข้อมูลเดียว และเปลี่ยนไปใช้ `site_settings` ทีละขั้นหลังยืนยัน |

## 6. สิ่งที่ต้องได้รับก่อนเริ่มเฟสนำเข้า

- [ ] เจ้าของยืนยันสิทธิ์และอนุมัติรายไฟล์ใน manifest (`rights.status`, `approval.status`)
- [ ] ความยินยอมสำหรับภาพบุคคล 7 ไฟล์ หรือการตัดสินใจไม่ใช้
- [ ] ความเห็นเรื่องการใช้ภาพตราแผ่นดิน
- [ ] ไฟล์โลโก้ต้นฉบับความละเอียดสูงหรือเวกเตอร์
- [ ] การยืนยันข้อมูลติดต่อ เวลาเปิด ที่อยู่ ลิงก์แผนที่ (รูปแบบที่ระบบรองรับ) และบัญชีโซเชียล
- [ ] การยืนยันเนื้อหาข่าว ข้อมูลเหรียญ และข้อความเชิงความเชื่อ
- [ ] อนุมัติให้เพิ่ม `mongoose` และสร้างโฟลเดอร์ `scripts/migration/`
- [ ] บัญชี Cloudinary และ MongoDB Atlas สำหรับ staging พร้อม credentials ใน `.env.local` (ผู้ดูแลเป็นผู้ตั้งค่า)
- [ ] อนุมัติแยกกันสำหรับ (1) การดาวน์โหลดไฟล์เพื่อนำไปใช้ (2) การอัปโหลดไป Cloudinary และ (3) การเขียนข้อมูลลง MongoDB

## 7. สิ่งที่ไม่ได้ทำในเฟส 02.5.1

- ไม่ได้บันทึกไฟล์ภาพจากเว็บอ้างอิงลงดิสก์ ไฟล์ถูกอ่านในหน่วยความจำเพื่อวัดค่าเท่านั้น
- ไม่ได้อัปโหลดไป Cloudinary ไม่ได้เชื่อมต่อหรือเขียน MongoDB
- ไม่ได้อ่านหรือแสดงค่าใน `.env.local`
- ไม่ได้แก้ไขหน้าเว็บของระบบใหม่ และไม่ได้สร้าง Admin CMS
- ไม่ได้เข้าถึง `/admin`, `/api/` หรือส่งฟอร์มของเว็บอ้างอิง
