# การจับคู่ข้อมูลจากระบบเดิม (Legacy Data Mapping)

**Phase:** 02.5.2 — Legacy Admin Data Mapping
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**สถานะ:** เอกสารออกแบบและวางแผนเท่านั้น ไม่มีการเชื่อมต่อ MongoDB ไม่มีการอัปโหลด Cloudinary ไม่มีการดาวน์โหลดสื่อ ไม่มีการเรียก API ของระบบเดิม และไม่มีการแก้โค้ดแอปพลิเคชัน

เอกสารชุดนี้:

| เอกสาร | เนื้อหา |
|---|---|
| **legacy-data-mapping.md** (ฉบับนี้) | การจับคู่ 17 โมดูล ระดับฟิลด์ ความสัมพันธ์ กลยุทธ์ย้ายข้อมูล และข้อขัดแย้ง |
| [`mongodb-schema-spec.md`](mongodb-schema-spec.md) | ข้อกำหนด Mongoose schema และ index (เอกสาร ไม่ใช่โค้ด) |
| [`migration-validation-checklist.md`](migration-validation-checklist.md) | ขั้นตอน dry-run และรายการตรวจสอบ |

## 0. แหล่งข้อมูลและระดับหลักฐาน

| รหัส | แหล่ง | ข้อจำกัด |
|---|---|---|
| **A** | รายงานตรวจ Admin CMS เดิม (`docs/legacy-admin-audit.md`) | เห็นจาก UI เท่านั้น ไม่ได้ดูฐานข้อมูล API หรือค่าที่บันทึก ไม่รู้รูปแบบ legacy ID |
| **P** | หน้าเว็บสาธารณะ (`reference-content-inventory.md`) | เห็นเฉพาะข้อมูลที่เผยแพร่ ไม่เห็นรายการที่ซ่อน ธง placeholder หรือ ID |
| **M** | `reference-media-manifest.json` | มีเฉพาะไฟล์สื่อที่เผยแพร่ ไม่มี legacy media ID |

> **หมายเหตุไฟล์:** เอกสาร audit ปัจจุบันอยู่ที่ `docs/legacy-admin-audit.md.md` (นามสกุลซ้ำ) และ **ยังไม่ถูก commit** ลิงก์ในเอกสารชุดนี้ใช้ชื่อที่ตั้งใจไว้ `legacy-admin-audit.md` ควรเปลี่ยนชื่อไฟล์แล้ว commit เพื่อให้ลิงก์ถูกต้อง

**ข้อสรุปสำคัญด้านแหล่งข้อมูล:** ระบบเดิมไม่มีปุ่ม export ใน UI ที่ตรวจ (A §7) และห้ามเรียก API ที่ไม่มีเอกสาร จึงต้องได้ข้อมูลจากช่องทางใดช่องทางหนึ่ง ตามลำดับความต้องการ:

1. **Export อย่างเป็นทางการ** จากผู้พัฒนา/ผู้ดูแลระบบเดิม (JSON หรือ CSV ที่มี legacy ID, `isPublished`, ลำดับ, ค่าหมวดหมู่, media reference และธง placeholder) — ทางเลือกหลัก
2. **การถอดข้อมูลด้วยมือ** โดยผู้ดูแลผ่าน UI เดิม ลงแบบฟอร์มที่กำหนด (ข้อมูลมี 37 รายการ + 2 singleton จึงทำได้จริง) — ทางเลือกสำรอง
3. **ข้อมูลจากหน้าเว็บสาธารณะ (P)** — ใช้ **ตรวจเทียบเท่านั้น** ไม่ใช้เป็นแหล่งหลัก เพราะไม่มีรายการที่ไม่เผยแพร่ ID และธง placeholder

## 1. สรุป 17 โมดูลของระบบเดิม

ช่องทาง: **M** = Media migration, **S** = Site Settings migration, **C** = Content migration, **—** = ไม่ย้ายข้อมูล

| # | โมดูล (เมนู) | route เดิม | key เดิม (A) | จำนวน (A) | เห็นบนเว็บ (P) | ช่องทาง | ปลายทาง |
|---:|---|---|---|---:|---:|---|---|
| 1 | หน้าแรกหลังบ้าน (Dashboard) | `/` | — | — | — | — | ไม่มีข้อมูลให้ย้าย สร้าง dashboard ใหม่ |
| 2 | ข่าวสารและกิจกรรม | `/c/news` | `news` | 3 | 3 | C (+M) | `news` |
| 3 | แกลเลอรี | `/c/gallery` | `galleryItems` | 10 | 10 | C (+M) | `gallery_items` |
| 4 | แบนเนอร์หน้าแรก | `/c/banners` | `banners` | 4 | 4 | C (+M) | `banners` |
| 5 | สิ่งศักดิ์สิทธิ์และวัตถุมงคล | `/c/sacred` | `sacredItems` | 5 | 5 | C (+M) | `sacred_items` |
| 6 | หมวดหมู่ | `/c/categories` | `categories` | 3 | 3 | C | `categories` |
| 7 | วิดีโอแนะนำ | `/c/videos` | `videos` | 1 | 0 | C (+M ถ้ามีไฟล์) | `videos` |
| 8 | รีวิวจากผู้มาสักการะ | `/c/reviews` | `reviews` | 3 | 0 | C | `reviews` |
| 9 | คำถามที่พบบ่อย | `/c/faqs` | `faqs` | 6 | 6 | C | `faqs` |
| 10 | ทีมงานผู้ดูแลศาล | `/c/team` | `teamMembers` | 2 | 2 (เห็นเฉพาะบทบาท) | C (+M) | `team_members` |
| 11 | เนื้อหาหน้าประวัติศาล | `/c/about` | `aboutPage` (singleton) | 1 | 1 | C (+M) | `pages` (`key: "history"`) |
| 12 | ข้อมูลศาลและช่องทางติดต่อ | `/c/settings` | `siteSettings` (singleton) | 1 | 1 | S (+M) | `site_settings` |
| 13 | ข้อความจากฟอร์ม | `/messages` | — | 0 | — | — | **ไม่ย้าย** (ข้อมูลส่วนบุคคล) |
| 14 | ข้อมูลตัวอย่างที่ต้องแก้ | `/placeholders` | — | 32 ฟิลด์ / 16 รายการ | — | C/S (ธงระดับฟิลด์) | `placeholderFields[]` ในเอกสารต้นทาง |
| 15 | ตรวจสุขภาพเว็บ | `/health` | — | — | — | — | คำนวณใหม่ (ไม่ย้ายผลตรวจ) |
| 16 | ประวัติการแก้ไข | `/log` | — | 120 วัน | — | — | **ไม่ย้ายโดยค่าเริ่มต้น** (มีตัวตนผู้แก้และค่าเก่า) |
| 17 | บัญชีและรหัสผ่าน | `/account` | — | — | — | — | **ไม่ย้าย** (รหัสผ่าน/session) สร้างบัญชีใหม่ผ่าน Auth.js |

ตัวเลขฐานสำหรับตรวจเทียบ: 3 news, 10 gallery, 4 banners, 5 sacred, 3 categories, 1 video, 3 reviews, 6 FAQs, 2 team และ 2 singleton

## 2. สัญลักษณ์ในตาราง mapping

| สัญลักษณ์ | ความหมาย |
|---|---|
| **R** / **O** | Required / Optional ตามที่ UI เดิมระบุ (`*`) |
| `[]` | Repeatable field (embedded array ที่มีลำดับ) |
| 🖼 | Media reference |
| SEO | SEO field |
| PUB | Publication status |
| ORD | Sort order |
| ID | Legacy identifier |
| (n) | เพดานจำนวนอักษรที่ UI แสดง (A) ใช้เป็น `maxlength` ในระบบใหม่ |

ทุกเรคอร์ดที่นำเข้ามีฟิลด์ร่วม `legacy` (ID), `status`, `review`, `placeholderFields[]` และ `migration` ตาม [`mongodb-schema-spec.md`](mongodb-schema-spec.md) §2 ซึ่งไม่ได้แสดงซ้ำในทุกตาราง

## 3. การจับคู่ระดับฟิลด์: โมดูลเนื้อหา

### 3.1 ข่าวสารและกิจกรรม `news` → `news`

| ฟิลด์เดิม (UI) | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ | การแปลง |
|---|---|---|---|---|---|---|
| (ID ใน route `/c/news/<id>`) | `id` | ไม่ทราบรูปแบบ | — | ID | `legacy.id` | คงค่าเดิมเป็น string |
| หัวข้อข่าว | `title` | text (120) | R | | `title` | trim ไม่แก้ข้อความ |
| ชื่อในลิงก์ | `slug` | slug | R | | `slug` | **คงเดิมทุกตัวอักษร** (§5) |
| วันที่ | `date` | date | R | ORD | `date` | เก็บ `YYYY-MM-DD` แบบ date-only ห้ามแปลง timezone |
| รูปปก + คำอธิบายรูป | `coverMediaId`, `coverAlt` | media + alt | R / O | 🖼 | `coverImage` (ImageRef) | `assetId` จาก media mapping, `alt` จาก `coverAlt` |
| สรุปสั้น | `excerpt` | textarea (220) | R | | `excerpt` | — |
| เนื้อหาข่าว | `body` | textarea (15,000) | R | | `body` | คงรูปแบบ "บรรทัดว่าง = ย่อหน้า, `**ตัวหนา**`" (§8.3) |
| รูปเพิ่มเติม | `images[]` (รูป R + alt) | array | O | `[]` 🖼 ORD | `images[]` (ImageRef) | คงลำดับตาม array |
| หัวข้อสำหรับ Google | `seo.title` | text (60) | O | SEO | `seo.title` | — |
| คำอธิบายสำหรับ Google | `seo.description` | text (155) | O | SEO | `seo.description` | — |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` → ดู §9 | ไม่เผยแพร่ทันที |

ลำดับ: ข่าวเรียงตามวันที่ล่าสุดก่อน ไม่มี `sortOrder` (A §4) ไม่พบ tags, ผู้เขียน, กำหนดเวลาเผยแพร่ หรือ pin
หลักฐานบนเว็บ (P): slug `know-tra-phaendin-siam`, `tra-phaendin-ceremony-2569`, `monks-blessing-ceremony` วันที่ 2026-03-20, 2026-03-16, 2026-03-16

### 3.2 สิ่งศักดิ์สิทธิ์และวัตถุมงคล `sacredItems` → `sacred_items`

| ฟิลด์เดิม (UI) | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ | การแปลง |
|---|---|---|---|---|---|---|
| (ID ใน route) | `id` | ไม่ทราบ | — | ID | `legacy.id` | — |
| ชื่อ | `name` | text (80) | R | | `name` | — |
| ชื่อในลิงก์ | `slug` | slug | R | | `slug` | คงเดิม |
| หมวดหมู่ | `categoryId` | select | R | | `categoryId` → `categories` | **ดู §6 ห้ามเดา** |
| ประเภท | `type` | enum 2 ค่า | R | | `type` | "สิ่งศักดิ์สิทธิ์ภายในศาล" → `shrine_worship`, "วัตถุมงคล (สอบถาม/สั่งจองทางไลน์)" → `sacred_object` |
| รูปหลัก + คำอธิบายรูป | `primaryMediaId`, `primaryAlt` | media + alt | R | 🖼 | `primaryImage` (ImageRef) | — |
| คำอธิบายสั้น | `excerpt` | (220) | R | | `excerpt` | — |
| รายละเอียด | `body` | textarea (8,000) | O | | `body` | รูปแบบเดียวกับข่าว |
| นิยมขอพรเรื่อง | `prayerTopics` | text (160) | O | | `prayerTopics` | ข้อความเดียว ไม่แยกเป็น array |
| ของไหว้ที่นิยม | `offerings` | text (400) | O | | `offerings` | — |
| ราคา/การบูชา | `offeringPriceText` | text (120) | O | | `inquiryText` | **เปลี่ยนชื่อ** เพราะระบบใหม่ไม่แสดงราคา (IA) ถ้าข้อความมีตัวเลขราคา ให้ dry-run เตือน และต้องให้เจ้าของตัดสินใจ |
| รุ่น/เนื้อ | `variants[]`: ชื่อ (60, R), จำนวนจัดสร้าง, หมายเหตุ (60) | array | O | `[]` ORD | `variants[]`: `name`, `quantity`, `note` | `quantity` แปลงเป็นตัวเลขเฉพาะเมื่อเป็นตัวเลขล้วน มิฉะนั้นเก็บ `quantityText` ซ่อนจากหน้าเว็บจนกว่า verified |
| SEO | `seo.title` (60), `seo.description` (155) | text | O | SEO | `seo` | — |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` | — |
| (ลำดับ) | `sortOrder` | — | — | ORD | `sortOrder` | คงลำดับเดิม |

หลักฐาน (P): 5 slug `pu-dam-168`, `tra-phaendin-siam`, `luang-pu-sila`, `coin-charoenlap-charoenyot`, `shrine-gate` เหรียญมี variants 8 แถวรวม 5,000 เหรียญ (ตรงกับ A ที่เห็น 8 แถว) ค่า "การบูชา" บนเว็บคือ "สอบถามราคาและสั่งจองทางไลน์" ค่า `type` ไม่ปรากฏบนเว็บ จึงต้องได้จาก export
เวลาเปิดที่หน้ารายละเอียดแสดง ("ทุกวัน 08:00–20:00 น.") **มาจาก site settings ไม่ใช่ฟิลด์ของรายการ** ระบบใหม่ต้องอ่านจาก `site_settings` เช่นกัน

### 3.3 หมวดหมู่ `categories` → `categories`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| ชื่อหมวด | `name` | (40) | R | | `name` |
| slug | `slug` | slug | R | | `slug` (คงเดิม ใช้ใน `/sakkara?cat=<slug>`) |
| คำอธิบายหมวด | `description` | (300) | O | | `description` |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |

หลักฐาน (P) บนหน้า `/sakkara`: `sacred-place` = สถานที่ศักดิ์สิทธิ์ (3), `saimu` = สายมู (1), `check-in` = จุดเช็กอิน (1) — A ระบุว่ามี 3 หมวดแต่ไม่ได้บันทึกชื่อ จึงยังไม่ยืนยันว่าเป็นชุดเดียวกัน

### 3.4 แกลเลอรี `galleryItems` → `gallery_items`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| รูป | `mediaId` | media | R | 🖼 | `image.assetId` |
| คำอธิบายรูป (alt) | `alt` | text | O | | `image.alt` |
| คำบรรยายใต้รูป | `caption` | (120) | O | | `image.caption` |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |
| — | — | — | — | | `galleryKey: "shrine-main"` (ค่าคงที่ เผื่อมีหลายแกลเลอรีในอนาคต) |

หลักฐาน (P): 10 ภาพในหน้า `/visit#gallery` ตามลำดับใน `reference-content-inventory.md` §6.1 หน้าแรกแสดง 4 ภาพแรกจากชุดเดียวกัน

### 3.5 แบนเนอร์หน้าแรก `banners` → `banners`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| รูปแบนเนอร์ (3:2 แนวนอน) | `mediaId` | media | R | 🖼 | `image.assetId` |
| alt | `alt` | text | O | | `image.alt` |
| คำบรรยายสั้นบนภาพ | `caption` | (40) | R | | `image.caption` |
| จุดสำคัญบนภาพ (มือถือ) | `focalPoint {x,y}` | normalized | O | 🖼 | `image.focalPoint` (0–1) **ห้ามแปลงสเกล** หากระบบเดิมเก็บเป็นเปอร์เซ็นต์ให้หาร 100 แล้วบันทึกค่าเดิมใน `legacy.raw` |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |

ไม่มี CTA ช่วงเวลาเผยแพร่ หรือภาพมือถือแยกในระบบเดิม ข้อความหัวแบนเนอร์ (ชื่อศาล คำโปรย ทำเล) **มาจาก site settings** ไม่ใช่จาก banners ระบบใหม่แสดงแบนเนอร์เป็นภาพนิ่ง (ไม่ autoplay) โดยใช้รายการที่ `sortOrder` ต่ำสุดที่เผยแพร่แล้ว ส่วน `mobileImage` เป็นฟิลด์ใหม่ที่ว่างไว้

### 3.6 วิดีโอแนะนำ `videos` → `videos`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| ชื่อวิดีโอ | `title` | (80) | R | | `title` |
| ไฟล์วิดีโอ MP4 ≤ 90 MB | `videoMediaId` | media | R | 🖼 | `videoAssetId` (Cloudinary `resource_type: video`) |
| ภาพปก อัตโนมัติ/เลือกเอง | `posterMediaId`, `posterMode` | media + enum | O | 🖼 | `poster` (ImageRef), `posterMode: "auto" \| "custom"` |
| คำอธิบาย | `description` | (300) | O | | `description` |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |

สถานะปัจจุบัน (A): 1 รายการแต่ **ยังไม่มีไฟล์วิดีโอ** (health แจ้ง required ขาด) และหน้าแรกซ่อนส่วนนี้ (P: "รอคลิปจากทางศาล") นำเข้าเฉพาะ metadata เป็น draft โดย `videoAssetId: null` และถือว่าไม่ผ่าน validation สำหรับการเผยแพร่ ไม่มีฟิลด์ YouTube URL ในโมดูลนี้ (ลิงก์ช่องอยู่ใน settings)

### 3.7 รีวิว `reviews` → `reviews`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| ชื่อผู้รีวิว | `displayName` | (40) | R | | `displayName` |
| อาชีพ/ที่มา | `sourceLabel` | (60) | O | | `sourceLabel` |
| ข้อความรีวิว | `quote` | (500) | R | | `quote` |
| คะแนน | `rating` | 1–5 | O | | `rating` |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |

หน้าเว็บ (P) แสดง "รอรีวิวที่ได้รับการยืนยัน" ทั้งที่ A พบ 3 รายการ แปลว่ารีวิวไม่ได้เผยแพร่ หรือเป็นข้อมูลตัวอย่าง จึงนำเข้าเป็น draft และเพิ่ม `consent.status: "pending"` เพราะชื่อผู้รีวิวเป็นข้อมูลบุคคล **ห้ามเผยแพร่รีวิวที่ไม่ได้รับการยืนยันว่าเป็นของจริง**

### 3.8 คำถามที่พบบ่อย `faqs` → `faqs`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| คำถาม | `question` | (140) | R | | `question` |
| คำตอบ | `answer` | (800) | R | | `answer` |
| แสดงในหน้าแรกด้วย | `showOnHome` | boolean | — | | `showOnHome` (แยกจาก publish) |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |

หลักฐาน (P): 6 ข้อบน `/visit#faq` หน้าแรกแสดง 3 ข้อแรก ซึ่งสอดคล้องกับการใช้ `showOnHome` แต่ยังไม่ยืนยันว่าเป็นค่าเดียวกัน และ FAQPage JSON-LD ต้องสร้างจากรายการที่เผยแพร่เท่านั้น

### 3.9 ทีมงานผู้ดูแลศาล `teamMembers` → `team_members`

| ฟิลด์เดิม | key เดิม | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ |
|---|---|---|---|---|---|
| (ID) | `id` | ไม่ทราบ | — | ID | `legacy.id` |
| ชื่อ | `name` | (60) | R | | `name` |
| ตำแหน่ง/หน้าที่ | `roleTitle` | (60) | R | | `roleTitle` |
| รูป (1:1) + alt | `photoMediaId`, alt | media | O | 🖼 | `photo` (ImageRef) |
| แนะนำตัวสั้น ๆ | `bio` | (300) | O | | `bio` |
| แสดงบนเว็บ | `isPublished` | boolean | — | PUB | `legacy.isPublished` |
| ลำดับ | `sortOrder` | — | — | ORD | `sortOrder` |

หน้า `/history` (P) แสดงการ์ด 2 ใบที่มีเพียงบทบาท ("ผู้ดูแลศาล", "หน่วยประชาสัมพันธ์และกิจกรรมสัมพันธ์") ขณะที่หน้าแรกแสดง "รอข้อมูลและภาพผู้ดูแล" ยังไม่รู้ว่าค่า `name` จริงคืออะไร `team_members` **ไม่ใช่บัญชีผู้ดูแลระบบ** และต้องมี `consent.status` สำหรับชื่อและรูปบุคคล

## 4. การจับคู่ระดับฟิลด์: Singleton

### 4.1 เนื้อหาหน้าประวัติศาล `aboutPage` → `pages` (`key: "history"`)

ชื่อโมดูลเดิมคือ "about" แต่ URL สาธารณะคือ `/history` จึงใช้ `key: "history"` และเก็บ `legacy.module: "aboutPage"` ไว้

| ฟิลด์เดิม (UI) | ชนิด | R/O | แท็ก | ฟิลด์ใหม่ | ใช้ที่หน้า |
|---|---|---|---|---|---|
| หัวข้อประวัติ | (80) | R | | `title` | `/history` H1 |
| ย่อหน้าแรก | (500) | R | | `intro` | `/history` |
| ประวัติความเป็นมา | long text (8,000) | R | | `historyBody` | `/history` |
| รูปประกอบประวัติ + alt | media | O | 🖼 | `historyImage` (ImageRef) | `/history` |
| คำคม/ข้อความเด่น | (140) | O | | `quote` | `/history` |
| หัวข้อแนะนำศาลในหน้าแรก | (40) | R | | `homeIntroHeading` | `/` (เช่น "ศรัทธาที่อยู่คู่ใจ") |
| หัวข้อเรื่องตราแผ่นดิน | (80) | R | | `coatOfArms.heading` | `/history` |
| เนื้อหาเรื่องตราแผ่นดิน | long text (8,000) | R | | `coatOfArms.body` | `/history` |
| รูปตราแผ่นดิน + alt | media | O | 🖼 | `coatOfArms.image` (ImageRef) | `/history` |
| ความหมายส่วนต่าง ๆ ของตรา | array: ส่วน (80, R) + ความหมาย (300, R) — 8 แถว | O | `[]` ORD | `coatOfArms.parts[]`: `key`, `part`, `meaning` | `/history` |
| เรื่องที่นิยมมาขอพร | array: เรื่อง (40, R) + คำอธิบาย (140) + ไอคอน (R) — 4 แถว | O | `[]` ORD | `wishTopics[]`: `key`, `topic`, `description`, `icon` | `/` |
| ขั้นตอนการสักการะ | array: ขั้นตอน (80, R) + รายละเอียด (300) — 4 แถว | O | `[]` ORD | `worshipSteps[]`: `key`, `title`, `detail` | `/`, `/history` |

ไม่มี publish toggle ใน singleton นี้ (A §5.10) `status` ของเอกสารจึงควบคุมโดยระบบใหม่ ไม่ได้มาจากระบบเดิม

ค่าไอคอนเดิม 7 ค่าแปลงเป็น enum ภาษาอังกฤษ: ลูกศรขึ้น → `arrow-up`, หมวกบัณฑิต → `graduation-cap`, กระเป๋า → `briefcase`, เอกสาร → `document`, เหรียญ → `coin`, มงกุฎ → `crown`, โล่ → `shield` (ชุดไอคอนปัจจุบันใน `src/components/ui/icons.js` ยังไม่มีไอคอนเหล่านี้ ต้องเพิ่มในเฟสพัฒนา CMS)

ทุก item ใน array ได้รับ `key` คงที่ (เช่น `wish-01`) ตอนนำเข้า เพื่อให้ path ของ placeholder ไม่เปลี่ยนเมื่อมีการเรียงลำดับใหม่ (§7)

### 4.2 ข้อมูลศาลและช่องทางติดต่อ `siteSettings` → `site_settings` (`key: "default"`)

| ฟิลด์เดิม (UI) | ชนิด | R/O | กลุ่มใหม่ | ฟิลด์ใหม่ | หมายเหตุ / หลักฐาน (P) |
|---|---|---|---|---|---|
| ชื่อศาล (แสดงบนเว็บ) | (60) | R | identity | `identity.name` | "ศาลปู่ดำ168 และตราแผ่นดิน" ตรงกับ `siteConfig.localName` |
| ชื่อสั้นบนแถบเมนูมือถือ | (30) | R | identity | `identity.shortName` | — |
| คำโปรยใต้ชื่อ | (80) | O | identity | `identity.tagline` | "ศรัทธาและบารมี ใจกลางพระนคร" |
| แนะนำศาลสั้น ๆ 1 ย่อหน้า | (400) | R | identity | `identity.description` | ใช้หน้าแรก ท้ายเว็บ และ meta/JSON-LD |
| ที่อยู่ | (200) | R | contact | `contact.address` | — |
| ทำเลสั้น ๆ | (80) | R | contact | `contact.locationShort` | "หลัง สน.พระราชวัง" |
| เวลาเปิด–ปิดแบบข้อความ | (60) | R | openingHours | `openingHours.displayText` | "08:00 – 20:00 น." |
| เวลาเปิด / เวลาปิด | HH:mm | R | openingHours | `openingHours.opens`, `.closes` | ค่าที่เป็นแหล่งข้อมูลหลัก (§4.3) |
| วันที่เปิด | (40) | R | openingHours | `openingHours.daysText` | "เปิดทุกวัน" |
| เบอร์โทร | phone | R | contact | `contact.phoneNumber` | **ชื่อเดียวกับ** `siteConfig.phoneNumber` |
| LINE ID | text | R | contact | `contact.lineId` | ค่าหลัก สร้าง `lineInquiryUrl` ตอนอ่าน (§4.3) |
| ลิงก์ Google Maps | URL | R | contact | `contact.directionsUrl` | **ชื่อเดียวกับ** `siteConfig.directionsUrl` ค่าที่เห็นเป็น `share.google/…` ซึ่ง `getMapsUrl()` ไม่ยอมรับ |
| คำค้นสำหรับแผนที่ในหน้าเว็บ | (120) | R | contact | `contact.mapEmbedQuery` | "ศาลปู่ดำ ตราแผ่นดิน สถานีตำรวจนครบาลพระราชวัง ถนนมหาราช" ห้ามฝังแผนที่จนกว่าจะยืนยัน |
| ลิงก์ Facebook / TikTok / YouTube | URL | O | socialLinks | `socialLinks[]`: `platform`, `url` | ต้องยืนยันว่าเป็นบัญชีของศาล |
| หัวข้อให้เลือกในฟอร์มติดต่อ | array หัวข้อ (60, R) — 5 แถว | O `[]` | contactTopics | `contactTopics[]`: `key`, `label` | ย้ายได้แต่ยังไม่ใช้ จนกว่าจะมี Contact Form |
| รูปตอนแชร์ลิงก์ + alt | media 1200×630 | O 🖼 | seo | `seo.defaultOgImage` (ImageRef) | `brand-og-default` |
| Google Analytics / Google Ads / Facebook Pixel ID | text | O | analytics | `analytics.*` | **ไม่ย้ายโดยค่าเริ่มต้น** (§10) |
| — (ใหม่) | | | branding | `branding.logo` (ImageRef) | ระบบเดิมไม่มีฟิลด์โลโก้ใน settings ที่ตรวจ ใช้ `brand-logo-mark` |

### 4.3 กฎแหล่งข้อมูลเดียว (single source of truth)

- **เวลาเปิด:** `opens`/`closes` เป็นค่าหลักสำหรับ JSON-LD ส่วน `displayText`/`daysText` เป็นข้อความแสดงผล dry-run ต้องเตือนเมื่อข้อความไม่ตรงกับเวลา (A §5.11 ระบุความเสี่ยงนี้)
- **LINE:** เก็บ `contact.lineId` (เช่น `@sanpudam168`) เป็นค่าหลัก บริการอ่านข้อมูลแปลงเป็น `lineInquiryUrl = https://line.me/R/ti/p/<lineId>` (รูปแบบเดียวกับที่เว็บเดิมใช้) แล้วส่งผ่าน `getLineUrl()` ใน `src/lib/contact-actions.js` เดิม **ไม่เก็บ URL ซ้ำในฐานข้อมูล**
- **โทรศัพท์และแผนที่:** ชื่อฟิลด์ตรงกับ `src/config/site.js` เพื่อให้ `getContactActions()` ใช้ได้ทันทีเมื่อเปลี่ยนแหล่งข้อมูลจาก config เป็น `site_settings`
- ระหว่างช่วงเปลี่ยนผ่าน หน้าเว็บยังอ่าน `src/config/site.js` (ค่าเป็น `null`) จนกว่าจะอนุมัติให้สลับแหล่งข้อมูล

## 5. การรักษา URL สาธารณะ

| URL เดิม | URL ใหม่ | การจัดการ |
|---|---|---|
| `/` | `/` | เหมือนเดิม |
| `/history` | `/history` | เหมือนเดิม (ข้อมูลจาก `pages[history]`) |
| `/sakkara` | `/sakkara` | เหมือนเดิม |
| `/sakkara?cat=<slug>` | `/sakkara?cat=<slug>` | รักษาพารามิเตอร์ `cat` ด้วย `categories.slug` เมื่อทำตัวกรองใน Phase 03 |
| `/sakkara?q=<คำค้น>` | `/sakkara?q=<คำค้น>` | รักษาพารามิเตอร์ `q` ใน Phase 03 |
| `/sakkara/<slug>` (5) | `/sakkara/<slug>` | slug คงเดิมทุกตัว |
| `/news` | `/news` | เหมือนเดิม |
| `/news/<slug>` (3) | `/news/<slug>` | slug คงเดิมทุกตัว |
| `/visit`, `/visit#gallery`, `/visit#faq` | เหมือนเดิม | รักษา anchor `#gallery`, `#faq`, `#travel`, `#contact` |
| `/admin/#/…` | (กำหนดภายหลัง) | ไม่ใช่ URL สาธารณะ ไม่ต้อง redirect เนื้อหา |
| `/img/<file>` | Cloudinary URL | ไม่ต้อง redirect ถ้าโดเมนเปลี่ยน ถ้าใช้โดเมนเดิม ควรพิจารณา redirect ภาพที่ถูกแชร์ภายนอก (เช่น `og-default.jpg`) |

กฎ: importer **ห้ามสร้าง slug ใหม่จากชื่อ** ถ้า slug เดิมซ้ำหรือไม่ผ่านรูปแบบ ให้รายงานเป็น conflict แทนการแก้อัตโนมัติ และรูปแบบ slug ที่อนุญาตต้องรองรับ slug เดิมทั้ง 8 ตัว (ตัวพิมพ์เล็ก ตัวเลข ขีดกลาง)

## 6. ปัญหา category selector ในระบบเดิม (ระดับวางแผน)

**สิ่งที่รู้:**

- A: ฟอร์ม sacred ทั้งแบบใหม่และแบบแก้ไขแสดงช่องหมวดหมู่เป็น "— เลือก —" เท่านั้น แม้หน้าหมวดหมู่จะมี 3 รายการ
- P: หน้าเว็บสาธารณะแสดงหมวดของทั้ง 5 รายการ (`pu-dam-168`, `tra-phaendin-siam`, `luang-pu-sila` → `sacred-place`; `coin-charoenlap-charoenyot` → `saimu`; `shrine-gate` → `check-in`) และตัวกรอง `?cat=` ทำงานฝั่งเซิร์ฟเวอร์
- จึงมีข้อมูลหมวดอยู่ที่ไหนสักแห่งที่หน้าเว็บใช้ได้ แต่ **ไม่รู้ว่าเก็บที่ไหนและอยู่ในรูปแบบใด**

**สมมติฐานที่ต้องตรวจ (ยังไม่สรุป):**

| # | สมมติฐาน | วิธีตรวจ (ไม่ต้องเรียก API แฝง) |
|---:|---|---|
| H1 | UI โหลดตัวเลือกไม่สำเร็จ (ข้อผิดพลาดฝั่ง client/API) แต่ข้อมูลถูกต้อง | ผู้พัฒนาเดิมตรวจ console/network log หรือ export ค่า `categoryId` |
| H2 | `categoryId` เก็บเป็น slug หรือชื่อ แต่ select คาดหวัง ID (หรือกลับกัน) | ดูค่าดิบใน export ของ sacred และ categories |
| H3 | select กรองเฉพาะหมวดที่ตรงกับ `type` หรือ `isPublished` แล้วไม่เหลือตัวเลือก | ดูเงื่อนไขกรองในโค้ดเดิม |
| H4 | หน้าเว็บสาธารณะไม่ได้ใช้ `categoryId` แต่คำนวณหมวดจากค่าอื่นหรือ hardcode | เทียบ export กับผลบนหน้าเว็บ |

**นโยบายการนำเข้า (ห้ามเดา):**

1. ใช้ค่า `categoryId` จาก export เท่านั้น แปลงเป็น ObjectId ผ่าน `legacy.id` ของ `categories`
2. ถ้าค่าไม่มี ว่าง หรือ resolve ไม่ได้: บันทึก `categoryId: null`, `categoryMapping.status: "unresolved"` และเก็บค่าดิบใน `categoryMapping.legacyValue`
3. หมวดที่เห็นบนหน้าเว็บ (P) บันทึกเป็น `categoryMapping.observedPublicSlug` เพื่อใช้ **เป็นหลักฐานประกอบเท่านั้น** ห้ามคัดลอกเป็น `categoryId` อัตโนมัติ
4. รายการที่ `unresolved` เผยแพร่ไม่ได้ จนกว่าเจ้าของเลือกหมวดใน CMS ใหม่ (`categoryMapping.status: "owner_confirmed"`)
5. dry-run แสดงตาราง: รายการ / ค่าดิบ / ผล resolve / หมวดที่เห็นบนเว็บ / ตรงกันหรือไม่

ใน CMS ใหม่ select ต้องแยกสถานะ loading / error / empty ตามข้อเสนอ P0 ของ audit

## 7. การรักษา metadata ของข้อมูลตัวอย่างระดับฟิลด์

ระบบเดิมมีหน้า `/placeholders` ที่นับ **32 ฟิลด์ใน 16 รายการ** (health นับ 16 รายการ) พร้อมปุ่ม "ข้อมูลนี้ถูกต้องแล้ว ไม่ต้องแก้" แต่ audit **ไม่ได้บันทึก path ของทั้ง 32 ฟิลด์**

โครงสร้างใหม่ (ทุก collection ที่เป็นเนื้อหาและ singleton):

```js
placeholderFields: [{
  path: "body",                 // dot path; ใน array ใช้ key ของ item เช่น "wishTopics.wish-02.description"
  status: "placeholder",        // placeholder | confirmed_correct | replaced
  source: "legacy",             // legacy | public_text_marker | new_cms
  legacyPath: String | null,    // path ตามระบบเดิม ถ้า export มี
  note: String | null,
  flaggedAt: Date,
  resolvedAt: Date | null,
  resolvedBy: ObjectId | null,  // → users
}]
```

กฎ:

- นำเข้าธงจาก export หรือจากการถอดข้อมูลหน้า `/placeholders` **ครบทั้ง 32 รายการ** ถ้าระบบเดิมบันทึกว่า "ถูกต้องแล้ว" ให้แปลงเป็น `confirmed_correct` และเก็บเวลาไว้
- ข้อความ "ตัวอย่าง" หรือ "รอ…" ที่เห็นบนเว็บ (P: 9 จุดใน `reference-content-inventory.md` §9) เพิ่มเป็นธง `source: "public_text_marker"` เฉพาะเมื่อธงจากระบบเดิมไม่มี path นั้น
- ห้ามล้างธงระหว่างนำเข้า และห้ามให้ค่าตัวอย่าง "กลายเป็นจริง" เมื่อเปลี่ยนรูปแบบข้อมูล
- เอกสารที่ยังมีธง `placeholder` อย่างน้อยหนึ่งรายการ **เผยแพร่ไม่ได้** (หรือต้องซ่อนฟิลด์นั้น ตามที่ CMS ใหม่กำหนด)
- dry-run ต้องนับธงหลังแปลงให้เท่ากับ 32 ฟิลด์ / 16 รายการ (หรืออธิบายส่วนต่างได้)

## 8. การจับคู่สื่อ

### 8.1 จาก URL เดิมไปยัง asset ใหม่

- ระบบเดิมอ้างอิงสื่อด้วย media ID ภายใน (`coverMediaId`, `primaryMediaId`, `mediaId`, `photoMediaId`, `videoMediaId`, `posterMediaId`) ซึ่งยังไม่ทราบค่า
- `media_assets` เก็บได้ทั้ง `legacy.mediaIds[]` (จาก export) และ `source.url` (จาก manifest) importer resolve ตามลำดับ: legacy media ID → URL ต้นทาง → SHA-256 ของไฟล์
- ภาพ 17 ไฟล์ใน manifest ครอบคลุมเฉพาะสื่อที่เผยแพร่ **ภาพที่ไม่เผยแพร่ (เช่น รูปทีมงาน ภาพปกวิดีโอ) ต้องได้จาก export** หาก export มีไฟล์ที่ไม่อยู่ใน manifest ให้เพิ่มเข้า manifest และตรวจสิทธิ์ก่อน

### 8.2 alt, caption และ focal point ระดับการใช้งาน

ระบบเดิมเก็บ alt แยกตามจุดที่ใช้ (`coverAlt`, `primaryAlt`, `images[].alt`, `alt` ของ gallery/banner) ระบบใหม่จึงกำหนดว่า:

- **ImageRef ในเอกสารเนื้อหาเป็นค่าหลัก** (`alt`, `caption`, `focalPoint`) ตามความหมายเดิม
- `media_assets.defaultAlt` เป็นเพียงค่าตั้งต้นสำหรับ media picker ไม่ใช้ทับค่าใน ImageRef

(ปรับจาก `media-migration-plan.md` §2 ที่เคยเสนอ alt หลักระดับ asset)

### 8.3 รูปแบบข้อความ body

ระบบเดิมใช้ "บรรทัดว่าง = ย่อหน้าใหม่" และ `**ข้อความ**` = ตัวหนา เก็บเป็น string เดิมใน `body` และระบุ `bodyFormat: "legacy-text-v1"` ฝั่งแสดงผลใช้ parser ที่รองรับเฉพาะย่อหน้าและตัวหนา **ห้าม render เป็น HTML ดิบ** (A §12 ข้อ 7)

## 9. การจัดการสถานะ draft และรอตรวจ

ระบบเดิมมีเพียง `isPublished` (boolean) ระบบใหม่แยกเป็น:

| ฟิลด์ | ค่า | ความหมาย |
|---|---|---|
| `status` | `draft` \| `published` \| `archived` | การแสดงบนเว็บ |
| `review.status` | `pending_review` \| `approved` \| `changes_requested` | การตรวจเนื้อหาโดยเจ้าของ |
| `legacy.isPublished` | boolean | ค่าเดิม เก็บไว้เป็น "ความตั้งใจเผยแพร่" |

กฎการนำเข้า:

1. **ทุกเรคอร์ดนำเข้าเป็น `status: "draft"` และ `review.status: "pending_review"`** ไม่ว่า `isPublished` เดิมจะเป็นค่าใด
2. หลังเจ้าของตรวจ: รายการที่ `review.status = approved` และ **ไม่มีธง placeholder ค้าง** และ **ผ่าน validation สำหรับเผยแพร่** สามารถเผยแพร่แบบกลุ่มได้ตาม `legacy.isPublished` (ต้องกดยืนยันใน CMS)
3. รายการที่ `legacy.isPublished = false` คงเป็น draft จนกว่าเจ้าของเลือกเผยแพร่เอง
4. ข้อมูลบุคคล (reviews, team_members) ต้องมี `consent.status = obtained` ก่อนเผยแพร่
5. รายการที่ `categoryMapping.status = unresolved` หรือขาดสื่อที่ required (เช่น video) เผยแพร่ไม่ได้

```text
import ─► draft + pending_review
            │ เจ้าของตรวจ/แก้ placeholder
            ▼
        draft + approved ──(ผ่าน validation, ไม่มี placeholder, consent ครบ)──► published
            │                                                                     │
            └──── changes_requested ◄──────────────── แก้ไขโดยผู้ดูแล ◄───────────┘ (archived เมื่อเลิกใช้)
```

## 10. ข้อมูลที่ไม่ย้าย

| ข้อมูล | เหตุผล | ทางเลือกในระบบใหม่ |
|---|---|---|
| รหัสผ่าน, session, token ของบัญชีเดิม (`/account`) | ความปลอดภัย และ hash เดิมอาจไม่เข้ากับระบบใหม่ | สร้างบัญชีใหม่ผ่าน Auth.js และกำหนด role ใหม่ |
| ข้อความจากฟอร์มติดต่อ (`/messages`) | ข้อมูลส่วนบุคคล (ชื่อ เบอร์ LINE ID) | ไม่ย้าย ถ้าจำเป็นจริงต้องมีขอบเขต retention และอนุมัติแยก |
| ประวัติการแก้ไข (`/log`) | มีตัวตนผู้แก้และค่าก่อน/หลัง อาจมีข้อมูลบุคคล | ไม่ย้ายโดยค่าเริ่มต้น หากต้องการ ให้ export เก็บเป็น archive แบบอ่านอย่างเดียวนอกฐานข้อมูลหลัก |
| ผล health check | เป็นผลคำนวณ ณ เวลาหนึ่ง | คำนวณใหม่ในระบบใหม่ |
| ค่า Google Analytics / Google Ads / Facebook Pixel | การติดตามผู้ใช้ต้องมีความยินยอม (PDPA) และนโยบายคุกกี้ | ย้ายเฉพาะเมื่อเจ้าของอนุมัติและมี consent mechanism แล้ว |

## 11. ช่องทางการย้ายข้อมูล 3 ช่องทาง

แต่ละช่องทางมี dry-run, การอนุมัติ และ log ของตัวเอง รันแยกกันได้ และรันซ้ำได้

| ลำดับ | ช่องทาง | ขอบเขต | ขึ้นกับ | ผลลัพธ์ |
|---:|---|---|---|---|
| 1 | **Media migration (M)** | ไฟล์ภาพ/วิดีโอที่ได้รับอนุมัติ → Cloudinary + `media_assets` | การอนุมัติสิทธิ์ใน manifest | ตาราง mapping: legacy media ID / URL เดิม → `media_assets._id` |
| 2 | **Site Settings migration (S)** | `siteSettings` → `site_settings` | M (โลโก้ ภาพแชร์) | `site_settings` 1 เอกสาร (draft) |
| 3 | **Content migration (C)** | categories → sacred_items, news, gallery_items, banners, videos, reviews, faqs, team_members, pages | M และ categories ก่อน sacred | เอกสารเนื้อหาทั้งหมด (draft) |

ภายในช่องทาง C ต้องนำเข้า `categories` ก่อน `sacred_items` เสมอ ถ้าภาพที่ต้องใช้ยังไม่ผ่านช่องทาง M ให้นำเข้าเนื้อหาโดยมี `assetId: null` และ `mediaMapping.status: "pending"` แทนการหยุดทั้งหมด (เอกสารนั้นเผยแพร่ไม่ได้)

## 12. กลยุทธ์ idempotent

**คีย์ธรรมชาติของแต่ละเรคอร์ด** (`legacy.key`, unique ต่อ collection):

| ลำดับความสำคัญ | คีย์ | ใช้เมื่อ |
|---:|---|---|
| 1 | `<module>:id:<legacyId>` | export มี legacy ID (ต้องการ) |
| 2 | `<module>:slug:<slug>` | news, sacred_items, categories ที่ไม่มี legacy ID |
| 3 | `<module>:singleton` | siteSettings, aboutPage |
| 4 | `<module>:hash:<sha256(ฟิลด์หลัก)>` | gallery/banners (hash ของ URL สื่อต้นทาง), faqs (hash ของคำถามที่ normalize), reviews/team (hash ของชื่อ+ข้อความ) — ใช้เฉพาะเมื่อไม่มี legacy ID และรายงานว่าเป็นคีย์อ่อน |

**กฎการเขียน:**

- ใช้ `updateOne({ "legacy.key": … }, { $setOnInsert: … }, { upsert: true })` สร้างครั้งเดียว ไม่เขียนทับ
- เก็บ `legacy.checksum` (SHA-256 ของข้อมูลต้นทางที่ normalize แล้ว) เมื่อรันซ้ำ:
  - checksum เท่าเดิม → ข้าม (`unchanged`)
  - checksum ต่าง และเอกสารยังไม่ถูกแก้ในระบบใหม่ (`migration.editedAfterImport = false`) → รายงาน `legacy_changed` อัปเดตได้เฉพาะเมื่อรันด้วย `--update-unedited` และได้รับอนุมัติ
  - checksum ต่าง และเอกสารถูกแก้แล้ว → `conflict` ไม่เขียน ให้คนตัดสินใจ
- ไม่มีคำสั่ง delete ใน importer ถ้ารายการหายจากต้นทาง ให้รายงาน `missing_in_source` เท่านั้น
- บันทึกทุกการรันใน `migration_runs` (ไม่มีความลับ) และ log JSONL ตาม `media-migration-plan.md` §4.2
- การรันครั้งที่สองด้วยข้อมูลเดิมต้องได้ผล 0 created, 0 updated (เป็นเกณฑ์ผ่านใน checklist)

## 13. ฟีเจอร์ระบบเดิมที่ควรรักษาและปรับปรุง

**รักษา (A §2):**

- ภาษาไทยที่เข้าใจง่าย ตัวนับจำนวนอักษรตามเพดานเดิม
- SEO รายเนื้อหา (title 60 / description 155) และ alt text ทุกภาพ
- จัดลำดับด้วยลากและปุ่มลูกศร
- focal point ของแบนเนอร์สำหรับมือถือ
- อัปโหลดหลายภาพในแกลเลอรี, preview, ลิงก์ "ดูบนเว็บ"
- singleton สำหรับข้อมูลศาลและหน้าประวัติ และ repeater ที่มีลำดับ
- ระบบธงข้อมูลตัวอย่างระดับฟิลด์พร้อมลิงก์ไปแก้ และปุ่ม "ถูกต้องแล้ว"
- health check (required, สื่อหาย, ส่วนว่าง, ลิงก์ติดต่อ)
- audit log ค่าก่อน/หลัง (ระบบใหม่ redact ข้อมูลลับ)
- `showOnHome` ของ FAQ แยกจากการเผยแพร่
- การสอบถาม/สั่งจองผ่าน LINE โดยไม่มีตะกร้าหรือการชำระเงิน

**ปรับปรุง (สรุปจาก A §13):**

| ระดับ | การปรับปรุง |
|---|---|
| P0 | category selector พร้อมสถานะ loading/error/empty |
| P0 | หน่วยนับ placeholder ตรงกันทุกหน้า ("32 ฟิลด์ใน 16 รายการ") |
| P0 | สถานะ Draft/Published + review แยกชัดในหน้ารายการ |
| P0 | error ใต้ฟิลด์ + สรุปด้านบน + เตือนเมื่อมีการแก้ที่ยังไม่บันทึก |
| P1 | media library กลางและ reuse asset, alt ต่อ usage, progress/retry ของ batch upload |
| P1 | preview desktop/mobile โดยเฉพาะ focal point |
| P1 | ตัวกรอง publish/category/type และจำนวนผลค้นหา |
| P1 | จัดลำดับด้วยคีย์บอร์ดพร้อมประกาศผล |
| P1 | แบ่ง Settings/About เป็นแท็บ |
| P1 | health แบบ ปัญหา → รายการ → ฟิลด์ |
| P2 | soft delete/restore และ safe content export ที่แยก PII ออก (เพื่อไม่ให้เกิดปัญหา "ไม่มี export" ซ้ำ) |
| ใหม่ | optimistic concurrency ด้วย `version`, review workflow และ consent tracking สำหรับภาพ/ข้อมูลบุคคล |

## 14. ความไม่สอดคล้องระหว่าง inventory (02.5.1) กับ Admin audit

| # | ประเด็น | Inventory 02.5.1 | Admin audit | การตัดสินใจในเฟสนี้ |
|---:|---|---|---|---|
| 1 | จำนวนโมดูล | เห็นเฉพาะหน้าเว็บ ไม่รู้จัก videos/reviews/team/categories เป็นโมดูล | 17 เมนู รวม videos, reviews, team, categories | ใช้ 17 โมดูลตาม audit |
| 2 | รีวิว | ไม่มีรีวิว (หน้าแรกแสดง "รอรีวิวที่ได้รับการยืนยัน") | 3 รายการ | นำเข้าเป็น draft + consent pending ห้ามเผยแพร่อัตโนมัติ |
| 3 | วิดีโอ | ไม่มีวิดีโอ | 1 รายการ ไม่มีไฟล์ | นำเข้า metadata เป็น draft ที่ไม่ผ่าน validation |
| 4 | ทีมงาน | หน้าแรก "รอข้อมูลและภาพผู้ดูแล" แต่ `/history` มี 2 การ์ดบทบาท | 2 รายการ มีชื่อ (R) | ต้องได้ค่าจริงจาก export ความต่างของสองหน้าอาจเกิดจากส่วนหน้าแรกที่ hardcode |
| 5 | ประเภทของ sacred | เสนอ `kind`: `worship_point` / `sacred_object` / `check_in_spot` | `type` 2 ค่า และ "จุดเช็กอิน" เป็น **หมวด** | ใช้ `type` 2 ค่าตามระบบเดิม ยกเลิกข้อเสนอ `kind` |
| 6 | หมวดหมู่ | เสนอเก็บใน `site_settings.taxonomies` | โมดูลแยก มีคำอธิบาย publish และลำดับ | ใช้ collection `categories` |
| 7 | แบนเนอร์ | เสนอเอกสารเดียว `home-hero` มี `slides[]`, title และ CTA | 4 รายการแยก มี caption (R) + focal point ไม่มี title/CTA | ใช้ collection `banners` รายการละเอกสาร ข้อความหัวมาจาก settings |
| 8 | แกลเลอรี | เสนอ `galleries` เอกสารเดียวมี `items[]` | `galleryItems` รายการละเอกสาร | ใช้ `gallery_items` + `galleryKey` |
| 9 | FAQ | เสนอ `pages[*].faq` | โมดูลแยก + `showOnHome` | ใช้ collection `faqs` |
| 10 | หน้า home/visit | เสนอ `pages[home]`, `pages[visit]` | มีเพียง singleton `aboutPage` หน้า home/visit ประกอบจาก settings, gallery, faqs | `pages` ระยะแรกมีเฉพาะ `history` |
| 11 | alt | alt หลักระดับ asset + override | alt/caption/focal เก็บระดับการใช้งาน | ImageRef เป็นค่าหลัก asset มีเพียง `defaultAlt` |
| 12 | Cloudinary namespace | ตามเรื่องของภาพ (subject) | ตามโมดูล (banners/news/sacred/…) | **คงตาม subject** เพราะภาพเดียวใช้หลายโมดูล (เช่น ภาพองค์ปู่ดำ 26 การอ้างอิงใน 10 หน้า) การจัดตามโมดูลจะทำให้ต้องอัปโหลดซ้ำ แต่ใช้ tag ระบุโมดูลที่ใช้งานได้ |
| 13 | ชื่อ collection | snake_case (`media_assets`, `sacred_items`) | camelCase (`mediaAssets`, `sacredItems`) | ใช้ **snake_case** สำหรับ collection และ camelCase สำหรับฟิลด์ (ดู schema spec §1) |
| 14 | LINE | เก็บ `lineInquiryUrl` | LINE ID เป็นแหล่งข้อมูลร่วมของทุกปุ่ม | เก็บ `lineId` แล้วสร้าง URL ตอนอ่าน |
| 15 | ราคาเหรียญ | ไม่มีราคา | มีฟิลด์ "ราคา/การบูชา" เป็นข้อความ | map เป็น `inquiryText` + ตรวจไม่ให้มีราคาตัวเลข |
| 16 | จำนวน placeholder | 9 จุดที่เห็นบนเว็บ | 32 ฟิลด์ใน 16 รายการ | ใช้ธงจากระบบเดิมเป็นหลัก จุดบนเว็บเป็นข้อมูลเสริม |
| 17 | แผนที่ | `share.google` จาก JSON-LD | ฟิลด์ลิงก์ Google Maps + คำค้นสำหรับแผนที่ฝัง | map ทั้งสองฟิลด์ ต้องขอลิงก์รูปแบบที่ `getMapsUrl()` รองรับ |
| 18 | แหล่งข้อมูลหลัก | หน้าเว็บสาธารณะ | ไม่พบ export ใน UI | ต้องได้ export อย่างเป็นทางการหรือถอดด้วยมือ (§0) |

เอกสาร 02.5.1 ที่เกี่ยวข้องได้รับหมายเหตุชี้มายังเอกสารนี้แล้ว

## 15. คำถามที่ยังไม่มีคำตอบ

1. ผู้พัฒนาระบบเดิม export ข้อมูลทั้งหมดได้หรือไม่ (รวมรายการที่ไม่เผยแพร่ legacy ID ธง placeholder และ media ID) และใช้รูปแบบใด
2. category selector ไม่แสดงตัวเลือกเพราะอะไร (H1–H4 ใน §6) และค่า `categoryId` ของทั้ง 5 รายการคืออะไร
3. path ของธง placeholder ทั้ง 32 ฟิลด์คืออะไร และมีรายการใดถูกกด "ถูกต้องแล้ว" ไปแล้วบ้าง
4. ค่า `type` ของทั้ง 5 รายการ (โดยเฉพาะ `shrine-gate`)
5. รีวิว 3 รายการเป็นของจริงหรือข้อมูลตัวอย่าง และได้รับความยินยอมหรือไม่
6. ชื่อจริงในทีมงาน 2 รายการ และได้รับความยินยอมให้เผยแพร่ชื่อ/รูปหรือไม่
7. จะมีไฟล์วิดีโอแนะนำหรือไม่
8. focal point ของแบนเนอร์เก็บเป็นสเกล 0–1 หรือเปอร์เซ็นต์
9. ระบบเดิมใช้ provider ใดเก็บสื่อ และมีไฟล์ต้นฉบับความละเอียดสูงกว่าที่เผยแพร่หรือไม่
10. delete ในระบบเดิมเป็น soft หรือ hard delete และมีรายการที่ถูกลบซึ่งต้องกู้คืนหรือไม่
11. ผู้ดูแลมีกี่คน ต้องการ role, 2FA หรือผู้อนุมัติเนื้อหาหรือไม่ และจะใช้ Auth.js provider แบบใด
12. ต้องการย้าย audit log เดิมเป็น archive หรือไม่
13. เจ้าของต้องการใช้รหัส Analytics/Ads/Pixel ในระบบใหม่หรือไม่ และพร้อมทำ consent banner หรือไม่
14. ข้อความ "ราคา/การบูชา" ของวัตถุมงคลมีตัวเลขราคาหรือไม่
