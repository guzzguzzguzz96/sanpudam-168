# แผนนำเข้า MongoDB (MongoDB Import Plan)

**Phase:** 02.5.5 — MongoDB Content & Media Migration Preparation
**วันที่:** 29 ตุลาคม 2569 (2026-10-29)
**สถานะ:** สร้าง Mongoose models, importer และชุดทดสอบเสร็จแล้ว รัน **dry run แบบออฟไลน์** แล้ว **ยังไม่ได้เชื่อมต่อ MongoDB Atlas และยังไม่มีการเขียนข้อมูล** การรัน preflight หรือ apply ต้องได้รับอนุมัติแยก

เอกสารที่เกี่ยวข้อง: [`mongodb-schema-spec.md`](mongodb-schema-spec.md) · [`legacy-data-mapping.md`](legacy-data-mapping.md) · [`content-extraction-results.md`](content-extraction-results.md) · [`cloudinary-import-plan.md`](cloudinary-import-plan.md) · [`migration-validation-checklist.md`](migration-validation-checklist.md)

## 1. สรุป

| รายการ | ผล |
|---|---|
| Mongoose models | 13 models (12 collection ข้อมูล + `migration_runs`) |
| เรคอร์ดที่จะนำเข้า | **56** = media 17 + content 39 |
| การอ้างอิงสื่อที่ resolve ได้ | **31/31** (รวมโลโก้ → `site_settings.branding.logo`) |
| ธง placeholder ที่รักษาไว้ | **32** ฟิลด์ใน 16 เรคอร์ด |
| ข้อผิดพลาดใน plan | 0 (คำเตือน 1: วิดีโอไม่มีไฟล์ ซึ่งเป็นสิ่งที่คาดไว้) |
| สถานะเนื้อหาหลังนำเข้า | ทุกเรคอร์ด `draft` / `pending_review` |
| Plan hash (เต็ม) | `3525e33166360a3b45362b17c0095eb4a2e62363f424c4171c17bfc37f8f29a4` |
| การทดสอบ | 18/18 ผ่าน (MongoDB) + 8/8 (Cloudinary) |

## 2. Schema ที่สร้าง

### 2.1 ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/models/shared.js` | sub-schema ร่วม: `ImageRefSchema`, `SeoSchema`, `PlaceholderFieldSchema`, `LegacySchema`, `MigrationSchema`, `ReviewStateSchema`, `ConsentSchema`, ฟิลด์ร่วม `contentFields()`, index ร่วม และกฎการเผยแพร่ |
| `src/models/<ชื่อ>.js` | model ละไฟล์ (13 ไฟล์) |
| `src/models/index.js` | รวม model และ `modelsByCollection` |
| `src/lib/db.js` | helper เชื่อมต่อฝั่งเซิร์ฟเวอร์: **ไม่เชื่อมต่อตอน import**, บังคับ `MONGODB_DB_NAME`, cache การเชื่อมต่อสำหรับ Next.js, ตรวจชื่อฐานข้อมูลหลังเชื่อมต่อ, ตัด connection string ออกจากข้อความ error |

models ใช้ relative import จึงโหลดได้ทั้งใน Next.js App Router และใน Node script ของการย้ายข้อมูล และใช้ `mongoose.models.X ?? mongoose.model(...)` เพื่อไม่ประกาศซ้ำตอน hot reload โปรเจกต์ตั้ง `"type": "module"` ใน `package.json` แล้ว (ไฟล์ทั้งหมดเป็น ESM อยู่แล้ว ผ่านการ lint และ build) และเพิ่ม dependency `mongoose@9.11.4` แบบ pin เวอร์ชัน

### 2.2 Collection (snake_case ตาม `mongodb-schema-spec.md` §1)

| Collection | Model | จำนวนที่จะนำเข้า |
|---|---|---:|
| `media_assets` | `MediaAsset` | 17 |
| `categories` | `Category` | 3 |
| `site_settings` | `SiteSettings` | 1 |
| `pages` | `Page` | 1 |
| `sacred_items` | `SacredItem` | 5 |
| `news` | `News` | 3 |
| `banners` | `Banner` | 4 |
| `gallery_items` | `GalleryItem` | 10 |
| `faqs` | `Faq` | 6 |
| `videos` | `Video` | 1 |
| `reviews` | `Review` | 3 |
| `team_members` | `TeamMember` | 2 |
| `migration_runs` | `MigrationRun` | (บันทึกการรัน) |

### 2.3 Validation

| เรื่อง | การบังคับ |
|---|---|
| Required / เพดานอักษร | ตามฟอร์มเดิม (`maxlength`) เช่น news title 120, excerpt 220, sacred name 80 |
| Slug | `^[a-z0-9]+(?:-[a-z0-9]+)*$` + unique (news, sacred_items, categories) |
| Unique identity | `_id` คงที่, `legacy.key` unique (partial), `legacy.module + legacy.id` unique, media: `manifestId`, `cloudinary.publicId`, `contentHash.sha256` unique |
| Media reference | `ImageRefSchema.assetId` → `media_assets`, `mediaMapping.status` (`resolved`/`pending`/`missing`) และ `manifestId` สำหรับตรวจย้อน |
| Category | `sacred_items.categoryId` → `categories` + `categoryMapping` (ค่าเดิมและ slug ที่ resolve) |
| SEO | title ≤ 60, description ≤ 155 |
| สถานะเผยแพร่ | `status` (`draft`/`published`/`archived`) + `review.status` |
| ลำดับ | `sortOrder` และ `legacy.sortOrder` (ค่าเดิม) |
| Embedded arrays | variants, ความหมายตรา, เรื่องขอพร (icon enum), ขั้นตอนสักการะ, contactTopics ทุก item มี `key` และ `sortOrder` |
| Placeholder ระดับฟิลด์ | `placeholderFields[]` (`path`, `legacyPath`, `status`, `source`, `flaggedAt`) |
| Legacy identifiers | `legacy` ครบ: module, id, key, checksum, `isPublished`, `isPlaceholder`, sortOrder, เวลาเดิม |

**Draft กับ published:** draft บันทึกได้แม้ข้อมูลยังไม่ครบ (เช่น วิดีโอที่ไม่มีไฟล์) แต่ hook `pre("validate")` จะ **ปฏิเสธการบันทึกเป็น `published`** ถ้า `review.status` ไม่ใช่ `approved`, ยังมีธง placeholder, มีภาพที่ resolve ไม่ได้ และตามกฎเฉพาะ collection: sacred items ต้องมีหมวดและ `inquiryText` ต้องไม่มีตัวเลข, วิดีโอต้องมีไฟล์, reviews และ team members ต้องได้ความยินยอม

**รักษาข้อมูลเดิม:** ไม่มีการตัดหรือเขียนข้อความใหม่ `inquiryText` (เดิม `price_note`) เก็บตามต้นฉบับ วันที่ข่าวเป็น `YYYY-MM-DD` เนื้อหา `body` เป็นรูปแบบเดิม (`legacy-text-v1`)

### 2.4 ส่วนที่ต่างจาก `mongodb-schema-spec.md`

เพิ่มเพื่อรองรับข้อมูลจริงจาก Phase 02.5.3 และการนำเข้าซ้ำ (ไม่ได้ลบฟิลด์ใดจาก spec):

- `legacy.isPlaceholder`, `legacy.createdAt`, `legacy.updatedAt` และ `sourceType: "admin_ui_capture"`
- `migration.preparedAt`, `importChecksum`, `sourceChecksum` (ใช้ตรวจการแก้ไขหลังนำเข้าและการเปลี่ยนของต้นทาง)
- `ImageRef.mediaMapping.manifestId`, `legacyMobileUrl`, `legacyWidth`, `legacyHeight`, `note`
- `sacred_items.categoryMapping.resolvedSlug`, `videos.videoMapping`, `site_settings.branding.logoNote` และ `analytics.excluded`/`legacyValuesPresent`
- `media_assets.legacy.key`, `cloudinaryImport`, หมวด `surroundings`
- `migration_runs.items[].collectionName` (เลี่ยงชื่อ `collection` ซึ่ง Mongoose สงวนไว้), track `mongodb` และ mode `preflight`

## 3. กลยุทธ์ชื่อฐานข้อมูล

- ต้องตั้ง **`MONGODB_DB_NAME`** อย่างชัดเจน ระบบ **ไม่อนุมานชื่อฐานข้อมูลจาก connection string**
- ชื่อที่แนะนำสำหรับ staging: **`sanpudam168_staging`**
- กฎของ importer (fail closed ก่อนเชื่อมต่อ):
  - ชื่อต้องมี token `staging` (แยกด้วย `-`, `_` หรือ `.`)
  - ปฏิเสธชื่อที่มี token `prod`, `production`, `prd`, `live`, `main`, `master` แม้จะมี `staging` อยู่ด้วย
  - ถ้า connection string ระบุชื่อฐานข้อมูลใน path และไม่ตรงกับ `MONGODB_DB_NAME` จะปฏิเสธเพราะกำกวม
  - apply ต้องมี `--confirm-db=<ชื่อตรงกันทุกตัวอักษร>`
  - หลังเชื่อมต่อ ต้องได้ `connection.db.databaseName` ตรงกับชื่อที่ตรวจแล้ว มิฉะนั้นหยุดทันที
- ฐานข้อมูล production ต้องเป็นชื่อแยก (เช่น `sanpudam168_production`) และ importer เฟสนี้ไม่รองรับการนำเข้า production

## 4. Identity และลำดับการนำเข้า

**Identity คงที่:**

- media: `_id` = 24 ตัวแรกของ `SHA-256("sanpudam168:media:" + manifestId)`, `legacy.key = "media:manifest:<manifestId>"`
- content: `_id` = `importId` จาก Phase 02.5.3 = 24 ตัวแรกของ `SHA-256("sanpudam168:" + legacy.key)` และ `legacy.key = "<module>:id:<legacyId>"`
- ตรวจแล้วว่า `_id` ทั้ง 56 ไม่ซ้ำกัน และ `legacy.key`/slug ไม่ซ้ำในแต่ละ collection

**ลำดับ (เพื่อให้ความสัมพันธ์มีอยู่ก่อนผู้อ้างอิง):**

1. `media_assets` → 2. `categories` → 3. `site_settings` → 4. `pages` → 5. `sacred_items` → 6. `news` → 7. `banners` → 8. `gallery_items` → 9. `faqs` → 10. `videos` → 11. `reviews` → 12. `team_members`

ก่อนเขียนแต่ละเรคอร์ด importer ตรวจว่าทุก `assetId`, `categoryId` และ `videoAssetId` ที่อ้างถึงมีอยู่ในฐานข้อมูลปลายทางแล้ว ถ้าไม่มีจะเป็น `blocked_missing_reference` และไม่เขียน หลังเขียนจะอ่านกลับและตรวจความสัมพันธ์อีกครั้งก่อนรายงาน `created`

## 5. Dry run แบบออฟไลน์

```bash
node migration/scripts/import-mongodb.mjs
```

ไม่ต้องใช้ credentials และไม่เชื่อมต่อเครือข่าย ขั้นตอน:

1. อ่าน `migration/manifests/media-assets-mapping.json` และ `migration/content/*.json`
2. สร้างเอกสาร 56 รายการ แปลง ImageRef เป็น `assetId` (ตรวจ SHA-256 ของไฟล์), ผูกโลโก้ตาม mapping, ตรวจหมวดหมู่
3. ตรวจ identity ซ้ำ และ validate ทุกเอกสารด้วย Mongoose model จริง
4. ตรวจว่า association ทั้ง 31 รายการใน mapping ปรากฏในเอกสาร
5. จำลองการนำเข้าในฐานข้อมูลหน่วยความจำ 2 รอบ (รอบแรกต้องได้ `created` ทั้งหมด รอบสองต้องได้ `unchanged` ทั้งหมด)
6. เขียนรายงาน `migration/reports/mongodb-dry-run.{json,md}` (gitignored)

**ผล dry run (29 ต.ค. 2569):**

| ตรวจ | ผล |
|---|---|
| เรคอร์ด | 56 (media 17, categories 3, site_settings 1, pages 1, sacred_items 5, news 3, banners 4, gallery_items 10, faqs 6, videos 1, reviews 3, team_members 2) |
| identity ไม่ซ้ำ | 56/56 |
| การอ้างอิงสื่อ | 31/31 resolve |
| การอ้างอิงหมวดหมู่ | 5/5 resolve |
| ธง placeholder | 32 |
| สถานะ | ทุกเรคอร์ดเนื้อหา `draft` / `pending_review` |
| วิดีโอ | `videoAssetId: null`, `videoMapping.status: "missing"` (คำเตือนที่คาดไว้) |
| Schema validation | ผ่านทุกเอกสาร |
| จำลองนำเข้า | รอบแรก `created` 56 · รอบสอง `unchanged` 56 · ไม่มีปัญหา |
| Plan hash | `3525e33166360a3b45362b17c0095eb4a2e62363f424c4171c17bfc37f8f29a4` (คงที่ทุกครั้งที่รัน) |

## 6. Preflight กับ staging (อนาคต ต้องได้รับอนุมัติ)

```bash
node --env-file=.env.local migration/scripts/import-mongodb.mjs --preflight
```

- ต้องตั้ง `MONGODB_URI` และ `MONGODB_DB_NAME` ใน `.env.local` (ผู้ดูแลตั้งเอง)
- ตรวจกฎชื่อฐานข้อมูล (§3) ก่อนเชื่อมต่อ แล้วตรวจชื่อหลังเชื่อมต่อ
- **อ่านอย่างเดียว:** แต่ละเรคอร์ดได้ `would_create`, `unchanged`, `edited_in_cms`, `source_changed`, `conflict` หรือ `would_block`
- ไม่สร้าง index ไม่เขียนเอกสาร ไม่เขียน `migration_runs`
- รายงานเก็บที่ `migration/reports/mongodb-preflight-<runId>.json`

## 7. Apply กับ staging (อนาคต ต้องได้รับอนุมัติ)

```bash
node --env-file=.env.local migration/scripts/import-mongodb.mjs --apply \
  --plan-hash=<plan hash เต็มจาก dry run ล่าสุด> \
  --confirm-db=<MONGODB_DB_NAME ตรงทุกตัวอักษร>
```

ลำดับ:

1. ตรวจกฎเป้าหมาย plan hash และ confirm-db (fail closed)
2. เชื่อมต่อและยืนยันชื่อฐานข้อมูล
3. `createIndexes()` ของทุก model (สร้าง index ที่ยังไม่มีเท่านั้น **ไม่ลบ index** ไม่ใช้ `syncIndexes`)
4. บันทึก `migration_runs` สถานะ `running`
5. นำเข้า 56 เรคอร์ดตามลำดับ §4
6. อัปเดต `migration_runs` ด้วยผลรายเรคอร์ดและจำนวน (ไม่มี credentials)
7. ปิดการเชื่อมต่อ

ตัวเลือก `--update-unedited`: ปรับเรคอร์ดที่ต้นทางเปลี่ยนแต่ยังไม่ถูกแก้ใน CMS (ค่าเริ่มต้นคือรายงานอย่างเดียว)

Exit code: `0` สำเร็จ · `1` ตรวจเป้าหมาย/plan/การเชื่อมต่อไม่ผ่าน · `2` มี conflict, blocked, failed หรือ verify_failed

## 8. Idempotency

| สถานการณ์ | ผล |
|---|---|
| ยังไม่มีเรคอร์ด | `created` (หลังตรวจความสัมพันธ์) |
| มีแล้ว ต้นทางไม่เปลี่ยน ไม่ถูกแก้ | `unchanged` (ไม่เขียน) |
| มีแล้ว ต้นทางไม่เปลี่ยน แต่ถูกแก้ใน CMS | `edited_in_cms` (ไม่แตะ) |
| ต้นทางเปลี่ยน ไม่ถูกแก้ใน CMS | `source_changed` (ไม่เขียน) หรือ `updated` เมื่อใช้ `--update-unedited` |
| ต้นทางเปลี่ยน และถูกแก้ใน CMS | `conflict` (ไม่เขียนทับ) |
| ไม่มีเรคอร์ดนี้ แต่มี `_id` อื่นใช้ `legacy.key`/slug/hash เดียวกัน | `conflict` (ไม่สร้างซ้ำ) |
| สิ่งที่อ้างถึงไม่มีในปลายทาง | `blocked_missing_reference` |

กลไก:

- `migration.sourceChecksum`: checksum ของเอกสารตามแผน ถ้าต่างจากที่บันทึกไว้แปลว่า **ต้นทางเปลี่ยน**
- `migration.importChecksum`: checksum ของเนื้อหาเอกสาร **ตามรูปแบบที่ model เก็บจริง** ตอนนำเข้า (หลังใส่ค่า default แล้ว) ถ้า checksum ปัจจุบันต่างจากค่านี้ หรือ `editedAfterImport` เป็น true แปลว่า **ถูกแก้ใน CMS**
- การ `updated` ใช้ replace แบบมีเงื่อนไข (`_id` + `importChecksum` + `__v` ต้องตรง) หากมีคนแก้ระหว่างรันจะกลายเป็น `conflict`
- importer **ไม่มีคำสั่งลบ** เรคอร์ดที่หายจากต้นทางจะไม่ถูกลบ

## 9. การกู้คืนเมื่อล้มเหลวกลางทาง

- แต่ละเรคอร์ดเขียนแยกกัน การรันซ้ำจะข้ามเรคอร์ดที่สำเร็จแล้ว (`unchanged`) และสร้างเฉพาะที่ยังขาด (ทดสอบแล้ว: ล้มเหลวที่เรคอร์ดที่ 4 แล้วรันซ้ำได้ `unchanged` 7 + `created` 1 ไม่มีข้อมูลซ้ำ)
- `migration_runs` ที่ค้างสถานะ `running` แสดงว่าการรันถูกขัดจังหวะ ให้รันซ้ำด้วย plan hash เดิม
- ถ้าต้องยกเลิกการนำเข้า staging ทั้งหมด: ผู้ดูแลลบ collection ใน **ฐานข้อมูล staging** ด้วยมือ (หรือสร้างฐานข้อมูล staging ใหม่) importer ไม่มีคำสั่งลบ ข้อมูลต้นทางในเครื่องยังอยู่ครบจึงนำเข้าใหม่ได้

## 10. รายการตรวจสอบ

**ก่อน preflight / apply**

- [ ] ได้รับอนุมัติให้เชื่อมต่อและเขียน MongoDB Atlas staging
- [ ] ผู้ดูแลตั้ง `MONGODB_URI` และ `MONGODB_DB_NAME=sanpudam168_staging` (หรือชื่อ staging อื่น) ใน `.env.local`
- [ ] ผู้ใช้ฐานข้อมูลมีสิทธิ์เฉพาะฐานข้อมูล staging (ไม่ใช่ทั้ง cluster)
- [ ] รัน dry run ล่าสุด: 0 error, plan hash คงที่
- [ ] รัน `node --test migration/scripts/tests/mongodb.test.mjs` ผ่านทั้งหมด

**หลัง apply**

- [ ] ผล `created` 56 (หรือ `unchanged` สำหรับเรคอร์ดที่มีแล้ว) ไม่มี `conflict`/`blocked`/`failed`
- [ ] รัน preflight ซ้ำได้ `unchanged` 56
- [ ] นับเอกสารแต่ละ collection ตรงกับ §2.2
- [ ] ทุกเอกสารเนื้อหา `status: "draft"`, `review.status: "pending_review"`
- [ ] ธง placeholder รวม 32, วิดีโอ `videoMapping.status: "missing"`
- [ ] ทุก `assetId`/`categoryId` ชี้ไปยังเอกสารที่มีอยู่
- [ ] `migration_runs` มีผลรายเรคอร์ดและไม่มี credentials
- [ ] บันทึกผลใน `migration-validation-checklist.md`

## 11. ความปลอดภัย

- ไม่อ่าน `.env.local` ในเฟสนี้ ไม่เชื่อมต่อ MongoDB Atlas ไม่เขียนข้อมูล
- importer ไม่พิมพ์และไม่บันทึก connection string, ชื่อผู้ใช้หรือรหัสผ่าน (ข้อความ error ผ่าน `sanitizeError`)
- ไม่นำเข้ารหัสผ่าน, session, ข้อความส่วนตัว, ประวัติการแก้ไข หรือค่า analytics
- ไม่มีการแก้ Cloudinary, เว็บไซต์เดิม หรือหน้าเว็บสาธารณะ

## 12. ความเสี่ยงที่เหลือ

1. **ยังไม่ได้ทดสอบกับ MongoDB จริง:** การทดสอบใช้ in-memory adapter กับ model จริง แต่ `createMongooseAdapter` (lean read, `replaceOne` แบบมีเงื่อนไข, unique index จริง) ยังไม่ได้รันกับ server preflight บน staging คือการตรวจครั้งแรก
2. **การตรวจ "แก้ไขหลังนำเข้า" อาศัย checksum:** CMS ใหม่ควรตั้ง `migration.editedAfterImport = true` เมื่อแก้เอกสารที่นำเข้า เพื่อเป็นสัญญาณที่สองนอกจาก checksum
3. **ข้อมูลตัวอย่าง:** 32 ฟิลด์ยังเป็นข้อมูลตัวอย่าง รีวิว 3 รายการและทีมงานเป็นตัวอย่าง จึงยังเผยแพร่ไม่ได้จนกว่าเจ้าของแก้
4. **ข้อมูลติดต่อ:** `contact.verified = false` และลิงก์แผนที่ `share.google` ยังไม่ผ่าน `getMapsUrl()`
5. **การเปลี่ยนชนิดโมดูลเป็น ESM:** `"type": "module"` ผ่าน lint/build แล้ว แต่ไฟล์ config ในอนาคตที่เป็น CommonJS ต้องใช้นามสกุล `.cjs`
6. **สิทธิ์ฐานข้อมูล:** ควรใช้ผู้ใช้ MongoDB ที่จำกัดสิทธิ์เฉพาะฐานข้อมูล staging เพื่อป้องกันการเขียนผิดฐาน
