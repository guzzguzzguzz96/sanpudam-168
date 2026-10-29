# การเชื่อมข้อมูล Next.js กับ MongoDB (Phase 02.5.6 — Step A)

สถานะ: **โครงสร้างพร้อมแล้ว แต่ยังไม่เชื่อมกับหน้าเว็บ** หน้าแรกยังใช้ `src/data/homepage-preview.js` เหมือนเดิม ไม่มี route ใดเรียกใช้ data layer นี้ และไม่มีการเขียนข้อมูลลง MongoDB

## 1. สถาปัตยกรรม data access

ทุกโมดูลอยู่ใน `src/server/cms/` และขึ้นต้นด้วย `import "server-only";` หาก Client Component import เข้าไป build จะล้มเหลวทันที

| ไฟล์ | หน้าที่ |
|---|---|
| `policy.js` | กฎการเผยแพร่: filter ของ query และการตรวจซ้ำรายเอกสาร (public / draft) projection ที่ตัดฟิลด์ภายในออก |
| `draft-access.js` | ตัวคุมสิทธิ์ draft (grant) ค่าเริ่มต้นปฏิเสธทุกคำขอ |
| `content-service.js` | repository แบบอ่านอย่างเดียว: `siteSettings`, `banners`, `sacredItems` (พร้อม categories), `news`, `gallery`, `faqs`, `historyPage`, `mediaAssets` |
| `media.js` | แปลง ImageRef เป็นภาพที่ component ใช้ และสร้าง URL ของ Cloudinary |
| `adapters.js` | แปลงเอกสาร MongoDB เป็น props ของ component หน้าแรกที่มีอยู่ (`composeHomepageData`) |
| `homepage.js` | โหลดทุก section ของหน้าแรกแบบขนาน (`loadHomepageContent`) |
| `index.js` | จุดเข้าใช้งานฝั่ง server: `getPublicContent()`, `getPublicHomepageContent()`, `getDraftContent(grant)` |

ลำดับการทำงาน:

```
Server Component (อนาคต)
  └─ getPublicHomepageContent()          src/server/cms/index.js
       └─ repositories (public scope)    content-service.js
            ├─ connectToDatabase()       src/lib/db.js (Mongoose, autoCreate/autoIndex ปิด)
            ├─ Model.find(publicFilter, projection, { lean, maxTimeMS })
            ├─ ตรวจซ้ำ isPubliclyVisible() ทุกเอกสาร
            └─ media_assets (rights approved) → media resolver
  └─ composeHomepageData(content, homepagePreviewData)  adapters.js
       └─ props เดิมของ HeroBanner, FeaturedSacredItems, LatestNews, ...
```

ทุก repository คืนผลรูปแบบเดียวกัน: `{ status: "ok" | "empty" | "unavailable", data, media }` ซึ่ง `media` คือ resolver สำหรับภาพในเอกสารชุดนั้น

## 2. Public กับ Draft

| | Public scope | Draft scope |
|---|---|---|
| เงื่อนไขเนื้อหา | `status = published` **และ** `review.status = approved` **และ** ไม่มี `placeholderFields.status = placeholder` | `status` เป็น draft หรือ published (ไม่รวม archived) |
| เงื่อนไขสื่อ | `rights.status = approved`, ไม่ถูกลบ, ไม่ใช่วิดีโอ | `rights.status ≠ rejected`, ไม่ถูกลบ |
| การบังคับใช้ | ใส่ใน query ของ MongoDB **และ** ตรวจซ้ำทุกเอกสารที่ได้กลับมา (defense in depth) | ต้องมี grant ที่ถูกต้อง |
| เมื่อฐานข้อมูลล่ม | คืน `unavailable` และ log ข้อความที่ตัดข้อมูลการเชื่อมต่อแล้ว | throw ให้ผู้แก้ไขเห็นข้อผิดพลาดจริง |

- เงื่อนไขของผู้เรียกไม่สามารถเขียนทับกฎเผยแพร่ได้ (`publicContentFilter({ status: "draft" })` ยังได้ `published`)
- หมวดหมู่ที่ยังไม่เผยแพร่จะถูกตัดทิ้ง (`category: null`) ไม่ใช้ค่าอื่นแทน
- ห้ามซ่อน draft ด้วย React component เพียงอย่างเดียว กฎทั้งหมดอยู่ที่ data access layer

## 3. ความปลอดภัยฝั่ง server

- อ่าน `process.env.MONGODB_*` ได้เฉพาะ `src/lib/db.js` และ `src/server/cms/index.js` (ตรวจด้วยการทดสอบ)
- ไม่มีตัวแปร `NEXT_PUBLIC_*` ที่เกี่ยวกับฐานข้อมูลหรือ secret
- projection ตัด `legacy` (รวม `legacy.raw`), `migration`, `createdBy` และ `updatedBy` ออกตั้งแต่ query ส่วน adapter ส่งออกเฉพาะฟิลด์ที่ component ใช้ โดย `review`, `placeholderFields`, `rights`, `assetId` และ `mediaMapping` ไม่ไปถึง component
- query เป็นแบบ `lean` และกำหนด `maxTimeMS: 5000` ทุกครั้ง และ data layer ไม่มีคำสั่งเขียนใด ๆ
- ข้อความ error ผ่าน `sanitizeError()` ซึ่งตัด connection string, user, password และ host ออก
- `assertDatabaseMatchesEnvironment()` ใน `src/lib/db.js` ทำงานแบบ fail closed:
  - `VERCEL_ENV=production` ร่วมกับชื่อฐานข้อมูลที่มี staging/dev/test/preview → ปฏิเสธ
  - `VERCEL_ENV=preview|development` ร่วมกับชื่อที่มี prod/production/prd/live → ปฏิเสธ
- การทดสอบหลัง build ตรวจว่า `.next/static` ไม่มี `MONGODB_URI`, `mongodb+srv` หรือชื่อฐานข้อมูล staging

## 4. ตัวแปรสภาพแวดล้อม

| ตัวแปร | Local | Vercel Preview | Production |
|---|---|---|---|
| `MONGODB_URI` | `.env.local` (ห้าม commit) | ตั้งใน Vercel (Preview เท่านั้น) | ตั้งใน Vercel (Production เท่านั้น) |
| `MONGODB_DB_NAME` | `sanpudam168_staging` | `sanpudam168_staging` | ฐานข้อมูล production แยกต่างหาก (ห้ามใช้ staging) |
| `MONGODB_DNS_SERVERS` | ใช้กับ migration CLI บน Windows เท่านั้น | ไม่ตั้ง | ไม่ตั้ง |
| `VERCEL_ENV` | ไม่มี | Vercel ตั้งให้อัตโนมัติ | Vercel ตั้งให้อัตโนมัติ |

ข้อแนะนำก่อน deploy (ยังไม่ได้ดำเนินการ):

- **ห้ามใช้ user ที่มีสิทธิ์ `atlasAdmin` ในแอปที่ deploy** ให้สร้าง database user แยกสำหรับแอป:
  - เว็บสาธารณะ: role `read` เฉพาะฐานข้อมูลของ environment นั้น
  - CMS ในอนาคต: role `readWrite` เฉพาะฐานข้อมูลนั้น และใช้ user แยกจากเว็บสาธารณะ
- แยก user ของ Preview กับ Production ให้แต่ละตัวเข้าถึงได้เพียงฐานข้อมูลเดียว
- จำกัด Network Access ของ Atlas ตามแนวทางการเชื่อมต่อจาก Vercel และหมุนรหัสผ่านเมื่อมีการเปลี่ยนผู้ดูแล
- ยังไม่ได้แก้ตัวแปรใน Vercel

## 5. Component ↔ Collection

| Section หน้าแรก | Collection / ฟิลด์ | Adapter | หมายเหตุ |
|---|---|---|---|
| HeroBanner | `banners.image`, `mobileImage` + `site_settings.identity.name/description` | `adaptHeroBanner` | ใช้ banner แรกที่ภาพ resolve ได้ ส่วน CTA และ eyebrow เป็นข้อความ UI เดิม |
| QuickInformation | `site_settings.openingHours`, `contact.locationShort`, `contact.phoneNumber` | `adaptVisitorInformation` | เบอร์โทรแสดงเมื่อ `contact.verified = true` เท่านั้น |
| QuickActions | `site_settings.contact` (LINE, แผนที่) | `adaptQuickActions` | ใช้ปุ่มภายนอกเฉพาะค่าที่ยืนยันแล้วและผ่าน validation |
| AboutSanpudam | `pages(key=history).homeIntroHeading/intro/historyImage` | `adaptAbout` | |
| FeaturedSacredItems | `sacred_items` + `categories` | `adaptFeaturedItems` | ใช้ `normalizeSacredItem` เดิม ไม่มีราคาหรือสต็อก |
| WorshipGuide | `pages.worshipSteps` | `adaptWorshipGuide` | `detail` ที่ไม่มีค่าเป็น `null` ไม่เติมข้อความ |
| LatestNews | `news` (เรียง `date` ใหม่สุด) | `adaptLatestNews` | วันที่แสดงแบบไทย พ.ศ. เช่น "29 ตุลาคม 2569" |
| PhotoGallery | `gallery_items(galleryKey=shrine-main)` | `adaptGallery` | คงรูปแบบ mosaic เดิมตามตำแหน่ง และข้ามรายการที่ไม่มีภาพ |
| VisitUs | `site_settings.contact.address`, `openingHours` | `adaptVisitorInformation` | ตอนนี้ปุ่มติดต่อใน VisitUs ยังอ่านจาก `siteConfig` ส่วน `contactConfig` ถูกเตรียมไว้สำหรับตอนเชื่อมจริง |
| Faq | `faqs(showOnHome=true)` | `adaptFaq` | |

ลิงก์ไปหน้า `/sakkara/<slug>` และ `/news/<slug>` จะสร้างเมื่อเปิด `routes` ที่ตรงกันเท่านั้น (ค่าเริ่มต้นปิดทั้งหมด เพราะยังไม่มี route)

## 6. การแปลงสื่อ (media resolver)

- อ่าน `assetId` จาก ImageRef แล้วดึง `media_assets` ครั้งเดียวต่อชุดเอกสาร (`_id: { $in }`) โดยเลือกเฉพาะ `cloudinary`, `width`, `height`, `defaultAlt`, `resourceType`, `rights` และ `deletedAt`
- ผลที่ได้คือ `{ src, width, height, alt, caption, focalPoint, publicId }` ซึ่งตรงกับที่ `MediaFrame` ใช้
  - `alt` ใช้ค่าจาก ImageRef ก่อน ถ้าไม่มีจึงใช้ `defaultAlt`
  - `focalPoint` แปลงจาก `{x, y}` (0–1) เป็น CSS เช่น `"55% 50%"`
- `cloudinaryImageUrl(asset, { width, height, crop, gravity })` สร้าง URL ที่ย่อขยายได้ (`f_auto,q_auto,...`) จาก `secureUrl` และ `publicId` ที่เก็บไว้ ซึ่งเป็นจุดเดียวที่สร้าง URL ของ Cloudinary
- ภาพที่ไม่มี `assetId`, `mediaMapping.status` ไม่ใช่ `resolved`, หาไม่พบ หรือสิทธิ์ยังไม่อนุมัติ จะได้ `null` และ component จะแสดง placeholder ที่อนุมัติแล้ว
- ไม่มีการแก้หรืออัปโหลดไฟล์ใน Cloudinary

## 7. สิทธิ์ draft (preview)

- `createDraftAccessPolicy({ authorize })` ออก grant เมื่อ `authorize(request)` คืน `{ subject, role }` เท่านั้น
- grant เก็บใน WeakSet ภายในโมดูล วัตถุที่สร้างเองหรือคัดลอกจาก grant จริงจึงใช้ไม่ได้
- `getDraftContent(grant)` ตรวจ grant ก่อน query ทุกครั้ง หากไม่ผ่านจะ throw `DraftAccessDeniedError`
- `defaultDraftAccessPolicy` **ปฏิเสธทุกคำขอ** เพราะยังไม่มีระบบยืนยันตัวตน **ไม่มี route สำหรับ preview**

ข้อกำหนดก่อนเปิด preview:

1. มีระบบยืนยันตัวตน (Auth.js) ที่ตรวจ session ฝั่ง server และกำหนด role ของผู้แก้ไขแล้ว
2. route preview ต้องเรียก `authorize` ที่ตรวจ session จริง ห้ามใช้ query string หรือ cookie ที่เดาได้
3. หน้า preview ต้องเป็น dynamic, ไม่ cache ร่วมกับหน้า public, และตั้ง `noindex`
4. บันทึก audit ว่าใครเปิดดู draft

## 8. พฤติกรรมเมื่อข้อมูลไม่ครบ (fallback)

| กรณี | ผล |
|---|---|
| ฐานข้อมูลเชื่อมต่อไม่ได้ / query error | section นั้นได้ `unavailable` แล้วใช้ UI ที่อนุมัติแล้ว (`homepage-preview.js`) ส่วน section อื่นยังทำงาน |
| collection ว่าง | `empty` ใช้ UI เดิมของ section นั้น |
| ภาพหายหรือยังไม่อนุมัติ | `image: null` แสดง placeholder ของ `MediaFrame` ส่วนแกลเลอรีข้ามรายการนั้น และ hero ใช้ banner ถัดไป |
| ข้อมูลติดต่อไม่ยืนยัน (`contact.verified = false`) หรือไม่ผ่าน validation | ไม่แสดงปุ่มหรือเบอร์ และคงข้อความ "รอข้อมูลยืนยัน" |
| ข้อมูลยังไม่เผยแพร่ | ไม่ถูกส่งออกจาก public scope ทั้ง query และการตรวจซ้ำ |
| ฟิลด์ไม่ครบ | ใช้ข้อความเดิมของ section หรือ `null` ไม่สร้างข้อมูลขึ้นเอง |

**ห้ามใช้ draft เป็น fallback ในทุกกรณี** และ `composeHomepageData(null, homepagePreviewData)` คืนข้อมูลเดิมของหน้าแรกโดยไม่เปลี่ยนแปลง (ตรวจด้วยการทดสอบ)

## 9. ลำดับการเชื่อมต่อ (ต้องได้รับอนุมัติแต่ละขั้น)

1. **Step A (เสร็จแล้ว):** data layer, policy, adapters และการทดสอบ
2. เจ้าของตรวจเนื้อหาใน staging: แก้ placeholder 32 จุด, ทบทวนสิทธิ์ของสื่อ, ยืนยันข้อมูลติดต่อ (`contact.verified`) และเปลี่ยน `review.status` / `status` ผ่านเครื่องมือที่อนุมัติ
3. สร้าง database user แบบ `read` สำหรับแอป และตั้งตัวแปรใน Vercel Preview
4. เพิ่ม `images.remotePatterns` สำหรับ `res.cloudinary.com/<cloud>/image/upload/**` ใน `next.config.mjs`
5. ให้ `src/app/page.js` เรียก `getPublicHomepageContent()` + `composeHomepageData()` โดยใช้ `"use cache"` + `cacheTag`/`cacheLife` (Cache Components เปิดอยู่) และปิด `siteConfig.isPreview` เมื่อเจ้าของอนุมัติ
6. ส่ง `contactConfig` ให้ `VisitUs` / `getContactActions` แทน `siteConfig`
7. ตรวจบน Preview แล้วจึงเตรียมฐานข้อมูลและ user ของ production แยกต่างหาก

## 10. การทดสอบ

`npm test` (offline ใช้ mock model ไม่เชื่อมต่อ Atlas) มี 31 การทดสอบ ครอบคลุม:

- filter แบบ published-only และการตรวจซ้ำรายเอกสาร
- การปฏิเสธเอกสาร pending_review, เอกสารที่มี placeholder ค้าง และเอกสาร draft
- grant ที่ไม่มี ปลอม หรือคัดลอกมา ถูกปฏิเสธก่อนมี query ใด ๆ
- การแปลงสื่อ, กรณีสื่อหาย และ URL ของ Cloudinary
- รูปแบบข้อมูลของ adapter ตรงกับ `homepage-preview.js`
- ฐานข้อมูลล่มหรือ collection ว่าง
- การตรวจ environment
- ขอบเขต server/client ทั้งในซอร์สโค้ดและใน `.next/static` หลัง build

`tests/support/register.mjs` แทน `server-only` ด้วย stub และแปลง alias `@/` ให้ใช้กับ Node ได้

## 11. ข้อจำกัดที่ทราบ

- ข้อมูลทั้ง 39 รายการใน staging ยังเป็น draft / pending_review ดังนั้น public scope จะได้ผลว่างทั้งหมดจนกว่าเจ้าของจะอนุมัติ ซึ่งเป็นพฤติกรรมที่ถูกต้อง สื่อทั้ง 17 รายการมี `rights.status = approved` (ใช้ได้ทันทีเมื่อเนื้อหาเผยแพร่) ส่วน `approval.status` ยังเป็น pending ซึ่งตาม spec §6 ไม่ใช่เงื่อนไขการแสดงผล
- ยังไม่มีเครื่องมือ CMS สำหรับอนุมัติหรือเผยแพร่ และยังไม่มีระบบยืนยันตัวตน draft จึงเข้าถึงไม่ได้
- โมดูลใน `src/server/cms/` ยังไม่ถูก bundle โดย Next.js เพราะยังไม่มี route ใด import การ build จริงของโมดูลเหล่านี้จะเกิดในขั้นเชื่อมต่อ
- โครงสร้าง banner ไม่มีหัวเรื่องหรือคำอธิบายของแต่ละ slide หัวเรื่องของ hero จึงมาจาก `site_settings.identity`
- ข้อมูล `directionsUrl` เดิม (`share.google/...`) ไม่ผ่าน validation ของ Google Maps ต้องให้เจ้าของยืนยันลิงก์ใหม่
- ยังไม่มีการ cache/revalidate เพราะต้องออกแบบพร้อมกับการเชื่อม route
