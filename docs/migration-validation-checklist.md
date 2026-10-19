# รายการตรวจสอบการย้ายข้อมูล (Migration Validation Checklist)

**Phase:** 02.5.2 — Legacy Admin Data Mapping
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**สถานะ:** ขั้นตอนและเกณฑ์สำหรับเฟส implementation ยังไม่มีการรันจริง

ใช้คู่กับ [`legacy-data-mapping.md`](legacy-data-mapping.md) และ [`mongodb-schema-spec.md`](mongodb-schema-spec.md) ทุกช่องทาง (Media / Site Settings / Content) ใช้ checklist นี้แยกกัน และเก็บผลไว้ใน `migration_runs`

## 1. ก่อนเริ่ม (Gate 0)

- [ ] ได้แหล่งข้อมูลอย่างเป็นทางการ: export จากผู้พัฒนาเดิม หรือแบบฟอร์มถอดข้อมูลที่ผู้ดูแลกรอก (ไม่ใช้การเรียก API ที่ไม่มีเอกสาร)
- [ ] บันทึก checksum ของไฟล์แหล่งข้อมูล และกำหนดช่วง content freeze ของระบบเดิม
- [ ] ยืนยันว่าแหล่งข้อมูล **ไม่มี** รหัสผ่าน, session/token, ข้อความจากฟอร์ม, audit log และค่า Analytics/Ads/Pixel หากมี ให้ตัดออกก่อนเข้าสู่ขั้นตอนถัดไป
- [ ] เจ้าของอนุมัติสิทธิ์สื่อรายไฟล์ใน manifest (เฉพาะช่องทาง Media)
- [ ] ใช้ฐานข้อมูลและ Cloudinary folder ของ **staging** ไม่ใช่ production
- [ ] credentials อยู่ใน `.env.local` ที่ผู้ดูแลตั้งเอง สคริปต์อ่านผ่าน `node --env-file` และไม่พิมพ์ค่าออก log
- [ ] มีแผน rollback: snapshot ของ staging database และรายการ public ID ที่จะสร้าง

## 2. ขั้นตอน dry-run

ค่าเริ่มต้นของสคริปต์ทุกตัวคือ dry-run ไม่มีการเขียนข้อมูล

1. **อ่านและ parse แหล่งข้อมูล** ตรวจรูปแบบไฟล์และนับรายการต่อโมดูล
2. **Normalize** ตัดช่องว่าง แปลงไอคอน/enum แปลงวันที่เป็น `YYYY-MM-DD` สร้าง `key` ให้ item ใน array
3. **Resolve ความสัมพันธ์** media (legacy media ID → URL → SHA-256), หมวดหมู่ (`categoryId` จาก export เท่านั้น)
4. **Validate** ตาม Draft validation และรายงานผล Publish validation ล่วงหน้า (ไม่บล็อกการนำเข้า draft)
5. **คำนวณคีย์ idempotent** และเทียบกับฐานข้อมูล staging แบบอ่านอย่างเดียว เพื่อจัดผลเป็น `create` / `unchanged` / `legacy_changed` / `conflict` / `invalid`
6. **สร้างรายงาน** ทั้ง JSON และ Markdown พร้อม `planHash`
7. ผู้ดูแลตรวจรายงานแล้วจึงรันด้วย `--apply --plan-hash=<ค่า>` ถ้าข้อมูลหรือแผนเปลี่ยน ค่า hash จะไม่ตรงและระบบปฏิเสธ

รายงาน dry-run ต้องมี:

- [ ] ตารางจำนวนต่อโมดูลเทียบกับจำนวนฐาน (§3)
- [ ] รายการ `invalid` พร้อมฟิลด์และเหตุผล
- [ ] ตาราง category mapping: รายการ / ค่าดิบ / ผล resolve / หมวดที่เห็นบนเว็บ / ตรงกันหรือไม่
- [ ] จำนวนธง placeholder ก่อนและหลังแปลง แยกตามสถานะ
- [ ] รายการสื่อที่ `mediaMapping.status` เป็น `pending` หรือ `missing`
- [ ] คำเตือนข้อมูลที่ขัดแย้งกัน (เช่น ข้อความเวลาเปิดไม่ตรงกับ `opens`/`closes`, `inquiryText` มีตัวเลขราคา, URL ติดต่อไม่ผ่าน `getLineUrl()`/`getMapsUrl()`/`getPhoneHref()`)
- [ ] ยืนยันว่ารายงานไม่มีข้อมูลบุคคลหรือความลับ

## 3. จำนวนรายการ (เทียบกับ Admin audit)

| โมดูล | จำนวนในระบบเดิม | เห็นบนเว็บ | ต้องนำเข้า | ผล dry-run | ผลหลังนำเข้า |
|---|---:|---:|---:|---:|---:|
| news | 3 | 3 | 3 | | |
| gallery_items | 10 | 10 | 10 | | |
| banners | 4 | 4 | 4 | | |
| sacred_items | 5 | 5 | 5 | | |
| categories | 3 | 3 | 3 | | |
| videos | 1 | 0 | 1 (draft, ไม่มีไฟล์) | | |
| reviews | 3 | 0 | 3 (draft, consent pending) | | |
| faqs | 6 | 6 | 6 | | |
| team_members | 2 | 2 | 2 (draft, consent pending) | | |
| pages (`history`) | 1 | 1 | 1 | | |
| site_settings | 1 | 1 | 1 | | |
| ธง placeholder | 32 ฟิลด์ / 16 รายการ | 9 จุด (ข้อความบนเว็บ) | 32 | | |
| media_assets (ช่องทาง M) | ไม่ทราบ | 17 ไฟล์ต้นฉบับ | เฉพาะที่อนุมัติ | | |

ถ้าจำนวนไม่ตรง ต้องอธิบายได้ (เช่น รายการที่ไม่เผยแพร่ซึ่งไม่ปรากฏบนเว็บ) ก่อนผ่าน Gate

## 4. การตรวจระดับฟิลด์

### 4.1 ทุกเอกสาร

- [ ] มี `legacy.key`, `legacy.keyStrength`, `legacy.checksum`, `legacy.sourceType` และ `migration.runId`
- [ ] `status = "draft"` และ `review.status = "pending_review"` ทุกเอกสาร
- [ ] `legacy.isPublished` ตรงกับค่าเดิม
- [ ] `sortOrder` ตรงกับลำดับเดิม (ยกเว้น news ที่เรียงตาม `date`)
- [ ] ไม่มีฟิลด์ใดเกิน `maxlength` ถ้าเกิน ให้รายงาน ห้ามตัดข้อความอัตโนมัติ
- [ ] ข้อความภาษาไทยไม่เสีย (encoding UTF-8, ไม่มีอักขระแทนที่ `�`)
- [ ] `body` คงรูปแบบย่อหน้าและ `**ตัวหนา**` และไม่มี HTML ดิบ

### 4.2 ตามโมดูล

- [ ] **news:** `slug` ตรง 3 ตัวเดิม; `date` เป็น `2026-03-20`, `2026-03-16`, `2026-03-16` ไม่เลื่อนวัน; ลำดับ `images[]` ตรงเดิม; มี coverImage และ alt
- [ ] **sacred_items:** `slug` ตรง 5 ตัวเดิม; `type` อยู่ใน enum; variants ของเหรียญ 8 แถว รวม 5,000 และ `showVariantQuantities = false`; `inquiryText` ไม่มีราคา
- [ ] **categories:** slug `sacred-place`, `saimu`, `check-in` (ถ้า export ตรง) ไม่มี slug ซ้ำ
- [ ] **category mapping:** ไม่มีรายการใดได้ `categoryId` จาก `observedPublicSlug` อัตโนมัติ รายการที่ resolve ไม่ได้มี `categoryMapping.status = "unresolved"`
- [ ] **gallery_items:** 10 รายการ ลำดับตรงกับ `/visit#gallery`, caption ≤ 120
- [ ] **banners:** 4 รายการ caption ครบ ≤ 40, focal point อยู่ในช่วง 0–1 และค่าดิบเก็บไว้ใน `legacy.raw` ถ้าต้องแปลงสเกล
- [ ] **videos:** `videoAssetId = null` และ Publish validation รายงานว่าขาดไฟล์
- [ ] **reviews / team_members:** `consent.status = "pending"`; ไม่มีข้อมูลติดต่อส่วนบุคคลเพิ่มจากที่ฟอร์มเดิมมี
- [ ] **faqs:** 6 รายการ, `showOnHome` ตรงเดิม
- [ ] **pages[history]:** coatOfArms.parts 8 แถว, wishTopics 4 แถว (ไอคอนแปลงเป็น enum ครบ), worshipSteps 4 แถว ทุก item มี `key`
- [ ] **site_settings:** ไม่มี `lineInquiryUrl` ซ้ำในฐานข้อมูล; `contact.verified = false`; `analytics.*` เป็น `null` และ `enabled = false`; contactTopics 5 แถว; socialLinks ทุกแถว `verified = false`

### 4.3 ธง placeholder

- [ ] จำนวนธง `source: "legacy"` = 32 ฟิลด์ ใน 16 เอกสาร (หรือมีคำอธิบายส่วนต่าง)
- [ ] ธงที่ระบบเดิมกด "ถูกต้องแล้ว" เป็น `confirmed_correct` พร้อมเวลา
- [ ] path ใน array ใช้ `key` ของ item ไม่ใช้ index ตัวเลข
- [ ] ข้อความตัวอย่างบนเว็บ 9 จุด มีธงครบ (จากระบบเดิม หรือ `public_text_marker`)
- [ ] ไม่มีธงหายระหว่างการแปลง (เทียบ before/after ในรายงาน)

## 5. การตรวจสื่อ (ช่องทาง Media)

- [ ] นำเข้าเฉพาะไฟล์ที่ `rights.status` และ `approval.status` เป็น `approved`
- [ ] SHA-256 ของไฟล์ต้นทางตรงกับ manifest ก่อนอัปโหลด
- [ ] `etag` (MD5) จาก Cloudinary ตรงกับ MD5 ที่คำนวณไว้
- [ ] public ID ตรงกับ manifest และไม่มีการ overwrite (`overwrite=false`)
- [ ] ไม่นำเข้าไฟล์อนุพันธ์ (`-800`, favicon, apple-touch-icon)
- [ ] ทุก ImageRef ในเนื้อหา resolve ได้ หรือมี `mediaMapping.status` ที่อธิบายได้
- [ ] ภาพที่มีบุคคลมี `rights.containsIdentifiablePeople = true` และ consent ที่ถูกต้อง
- [ ] ไม่มี orphan asset ที่ไม่ได้ตั้งใจ (asset ที่ไม่มีเนื้อหาใดอ้างอิง)

## 6. ความสัมพันธ์และ URL

- [ ] `sacred_items.categoryId` ทุกค่าที่ไม่ใช่ `null` ชี้ไปยัง `categories` ที่มีอยู่
- [ ] ไม่มี slug ซ้ำใน `news`, `sacred_items`, `categories`
- [ ] URL สาธารณะทั้งหมดใน `legacy-data-mapping.md` §5 สร้างได้จากข้อมูลที่นำเข้า (`/news/<slug>` 3, `/sakkara/<slug>` 5, `/sakkara?cat=<slug>` 3)
- [ ] `pages` และ `sacred_items` ไม่มีข้อมูลติดต่อหรือเวลาเปิดคัดลอกมาจาก settings

## 7. Idempotency

- [ ] รันครั้งที่สองด้วยแหล่งข้อมูลเดิม: `created = 0`, `legacyChanged = 0`, `conflict = 0`
- [ ] แก้ข้อมูลหนึ่งรายการใน staging CMS แล้วรันซ้ำ: รายการนั้นเป็น `conflict` และไม่ถูกเขียนทับ
- [ ] จำลองการเปลี่ยนข้อมูลต้นทางหนึ่งรายการ: ได้ `legacy_changed` และอัปเดตเฉพาะเมื่อใช้ `--update-unedited`
- [ ] ลบรายการหนึ่งออกจากแหล่งข้อมูลจำลอง: ได้ `missing_in_source` และไม่มีการลบในฐานข้อมูล
- [ ] รันที่ล้มเหลวกลางทางแล้ว resume ต่อได้ โดยไม่สร้างข้อมูลซ้ำ

## 8. ความปลอดภัยและข้อมูลส่วนบุคคล

- [ ] ไม่มีรหัสผ่าน, hash, session, token จากระบบเดิมในฐานข้อมูลใหม่
- [ ] ไม่มีข้อความจากฟอร์มติดต่อ และไม่มี `contact_messages` ที่มาจากการนำเข้า
- [ ] ไม่มี audit log เดิมในฐานข้อมูลใหม่ (เว้นแต่ได้รับอนุมัติแยกเป็น archive)
- [ ] log, รายงาน และ `migration_runs` ไม่มีค่า environment, connection string, API key/secret หรือลายเซ็น
- [ ] ไม่มีการเรียก `/admin` หรือ `/api/` ของระบบเดิม
- [ ] ไม่มีค่าการตลาด (GA/Ads/Pixel) เว้นแต่เจ้าของอนุมัติและมี consent mechanism

## 9. ตรวจบน staging หลังนำเข้า

- [ ] หน้า `/`, `/history`, `/sakkara`, `/sakkara/<slug>` ×5, `/news`, `/news/<slug>` ×3, `/visit` แสดงผลจากข้อมูล draft ใน preview mode ได้ (หน้าเว็บจริงยังไม่แสดงข้อมูล draft)
- [ ] ภาพ desktop/mobile และ focal point ของแบนเนอร์ไม่ตัดจุดสำคัญ
- [ ] ปุ่ม LINE / แผนที่ / โทร แสดงเฉพาะเมื่อ `contact.verified = true` และผ่านการตรวจรูปแบบ
- [ ] SEO title/description, Open Graph และ JSON-LD (FAQPage, NewsArticle) สร้างจากข้อมูลที่เผยแพร่เท่านั้น
- [ ] ส่วนที่ไม่มีข้อมูลเผยแพร่ (วิดีโอ รีวิว ทีมงาน) ถูกซ่อน ไม่แสดงข้อความตัวอย่าง
- [ ] noindex/nofollow ยังเปิดอยู่ตลอดช่วงต้นแบบ

## 10. Gate ก่อนเผยแพร่ (หลังเจ้าของตรวจ)

- [ ] ทุกเอกสารที่จะเผยแพร่มี `review.status = "approved"`
- [ ] ไม่มีธง `placeholder` ค้างในเอกสารที่จะเผยแพร่
- [ ] Publish validation ผ่าน (ดู `mongodb-schema-spec.md` §6)
- [ ] เจ้าของยืนยันข้อมูลติดต่อ และเปลี่ยน `contact.verified = true`
- [ ] ตัดสินใจเรื่อง canonical/redirect ของเว็บเดิม และกำหนดวัน final import หลัง content freeze
- [ ] บันทึก rollback point (snapshot ฐานข้อมูลและรายการ public ID)

## 11. การ rollback

- ฐานข้อมูล staging: คืนค่าจาก snapshot ที่บันทึกก่อน apply
- Cloudinary: ใช้รายการ public ID จาก `migration_runs` ตรวจสอบ ห้ามลบอัตโนมัติจากสคริปต์นำเข้า การลบต้องทำด้วยมือโดยผู้มีสิทธิ์ หลังยืนยันว่าไม่มีเนื้อหาอ้างอิง
- ระบบเดิมยังเปิดใช้งานตลอดช่วงทดสอบ จึงไม่มีข้อมูลสูญหายจากการ rollback
