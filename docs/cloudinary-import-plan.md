# แผนนำเข้าสื่อไป Cloudinary (Cloudinary Import Plan)

**Phase:** 02.5.4 — Cloudinary Media Import (Staging)
**วันที่:** เตรียม 19 ตุลาคม 2569 · นำเข้าจริง 29 ตุลาคม 2569 (2026-10-29)
**สถานะ:** **นำเข้า staging เสร็จแล้ว** — เจ้าของอนุมัติให้อัปโหลดทั้ง 17 ไฟล์แบบ public (`upload`) ไปยัง `sanpudam168/staging/legacy/` อัปโหลดสำเร็จ 17/17 และตรวจหลังอัปโหลดผ่าน 17/17 (ดู §12) **ยังไม่ได้เขียน MongoDB** ซึ่งต้องได้รับอนุมัติแยก

เอกสารที่เกี่ยวข้อง: [`media-extraction-results.md`](media-extraction-results.md) · [`media-migration-plan.md`](media-migration-plan.md) · [`mongodb-schema-spec.md`](mongodb-schema-spec.md) §3.12 · [`../migration/README.md`](../migration/README.md)

## 1. สรุป

| รายการ | ค่า |
|---|---|
| ไฟล์ที่จะอัปโหลด | 17 ไฟล์ต้นฉบับ (WebP 15, PNG 1, JPEG 1) |
| ขนาดรวม | 4,186,460 ไบต์ (3.99 MB) |
| การตรวจไฟล์ต้นฉบับ | ผ่านครบ 17/17 (มีอยู่จริง, MIME จาก magic bytes, ขนาด, มิติ, SHA-256 เทียบ manifest และบัญชี 02.5.1, MD5) |
| ไฟล์ซ้ำ (SHA-256) / public ID ซ้ำ | 0 / 0 |
| ปลายทางเริ่มต้น | namespace staging `sanpudam168/staging/legacy/` |
| Delivery type เริ่มต้น | `upload` (สาธารณะ ดู §4) |
| Plan hash ของ dry-run ล่าสุด | `a938cb7e381fbbc4c8f9b34a6121ef1cb0701fe644db874b702ebee67342e806` (ค่า root/folder mode/delivery type เริ่มต้น) |

ไฟล์อัปโหลดแบบไบต์ต่อไบต์ ไม่ย่อขนาด ไม่บีบอัดใหม่ ไม่แปลงรูปแบบ และไม่ขยายโลโก้ importer ไม่มีโค้ดสำหรับลบ เปลี่ยนชื่อ หรือเขียนทับ asset

## 2. คำสั่ง

รันจากรากโปรเจกต์ด้วย Node.js 24 ทุกคำสั่งตรวจไฟล์ต้นฉบับใหม่ก่อนเสมอ และหยุดทันทีถ้าไฟล์ใดไม่ผ่าน

```bash
# ตรวจไฟล์ต้นฉบับอย่างเดียว
node migration/scripts/verify-media.mjs

# ตรวจหลังอัปโหลด (อ่านอย่างเดียว: Admin API + ดาวน์โหลด URL สาธารณะเทียบ SHA-256)
node --env-file=.env.local migration/scripts/verify-cloudinary.mjs

# สร้าง mapping สำหรับ media_assets (ไฟล์ในเครื่องเท่านั้น ไม่เชื่อมต่อ MongoDB)
node migration/scripts/build-media-mapping.mjs

# Dry run (ค่าเริ่มต้น): ออฟไลน์ ไม่ใช้ credentials ไม่เรียกเครือข่าย
node migration/scripts/import-cloudinary.mjs
#   ถ้าตั้งค่า import root / folder mode / delivery type ไว้ใน .env.local
#   ให้รัน dry run ด้วยค่าชุดเดียวกัน เพื่อให้ plan hash ตรงกับตอน apply:
node --env-file=.env.local migration/scripts/import-cloudinary.mjs

# Preflight แบบอ่านอย่างเดียว (ต้องใช้ credentials): ตรวจว่า public ID มีอยู่แล้วหรือไม่
node --env-file=.env.local migration/scripts/import-cloudinary.mjs --preflight

# อัปโหลดจริง: ต้องได้รับอนุมัติก่อน และใช้ plan hash จาก dry run ล่าสุด
node --env-file=.env.local migration/scripts/import-cloudinary.mjs --apply --plan-hash=<hash>

# ทดสอบ importer กับ mock server ในเครื่อง (ไม่เชื่อมต่อ Cloudinary)
node --test migration/scripts/tests/cloudinary.test.mjs
```

ตัวเลือกเพิ่มเติม: `--only=<manifestId,...>` นำเข้าเฉพาะบางไฟล์ · `--target=production --confirm-root=<root>` สำหรับปลายทาง production (ต้องได้รับอนุมัติแยก) · `--out=<dir>` เปลี่ยนที่เก็บผลลัพธ์ (ใช้ในการทดสอบ)

Exit code: `0` สำเร็จ · `1` ตรวจไฟล์ไม่ผ่าน, ไม่มี credentials, plan hash ไม่ตรง หรือปลายทางไม่ใช่ staging · `2` มีรายการ conflict, failed หรือ verify_failed

## 3. Environment variables

ตั้งค่าใน `.env.local` โดยผู้ดูแล (ไฟล์นี้ถูก ignore โดย Git) ชื่อทั้งหมดอยู่ใน `.env.example` แล้ว

| ตัวแปร | จำเป็น | ความลับ | ค่าเริ่มต้น | หน้าที่ |
|---|---|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | preflight/apply | ไม่ | — | ชื่อ cloud |
| `CLOUDINARY_API_KEY` | preflight/apply | **ใช่** | — | ใช้ลงนามคำขอและ Basic auth ของ Admin API |
| `CLOUDINARY_API_SECRET` | preflight/apply | **ใช่** | — | ใช้คำนวณลายเซ็น ไม่ถูกส่งออกไปในคำขอ |
| `CLOUDINARY_IMPORT_ROOT` | ไม่ | ไม่ | `sanpudam168/staging/legacy` | namespace ปลายทาง ต้องมี segment `staging` เว้นแต่ยืนยัน production |
| `CLOUDINARY_FOLDER_MODE` | ไม่ | ไม่ | `dynamic` | `dynamic` ส่ง `asset_folder` คู่กับ `public_id` · `fixed` ใช้ path ใน `public_id` เป็นโฟลเดอร์ (ดูได้ในหน้า Settings ของ Cloudinary) |
| `CLOUDINARY_DELIVERY_TYPE` | ไม่ | ไม่ | `upload` | `upload` (สาธารณะ), `authenticated` หรือ `private` |
| `CLOUDINARY_API_BASE` | ไม่ | ไม่ | Cloudinary API | ใช้เฉพาะการทดสอบ ยอมรับเฉพาะ API จริงหรือ server ใน `127.0.0.1` |

การป้องกันความลับ:

- ไม่มี credentials ใน source code หรือรายงาน summary แสดงเพียง `cloudName: "(set)"`
- API secret ใช้คำนวณลายเซ็นในเครื่องเท่านั้น ไม่ถูกส่งในคำขอ (การทดสอบตรวจว่า mock server ไม่ได้รับฟิลด์ `api_secret`)
- ข้อความ error จาก API ผ่านการแทนที่ค่า key/secret ด้วย `[redacted]`
- การทดสอบตรวจว่าไม่มี key หรือ secret ปรากฏใน stdout, stderr, log, state และ manifest

## 4. ปลายทาง staging และการเข้าถึงไฟล์

**แนวทางที่แนะนำ:** ใช้ Cloudinary product environment แยกสำหรับ staging (บัญชี Cloudinary รองรับหลาย product environment) ถ้าไม่มี ให้ใช้ namespace แยก `sanpudam168/staging/legacy/` ใน environment เดียวกัน importer จะ **ปฏิเสธ** root ที่ไม่มี segment `staging` เว้นแต่รันด้วย `--target=production --confirm-root=<root ที่ตรงกันทุกตัวอักษร>`

**โฟลเดอร์ staging ไม่ได้ทำให้ไฟล์เป็นส่วนตัว:**

- delivery type `upload` (ค่าเริ่มต้น) ทำให้ทุกไฟล์ดูได้แบบสาธารณะผ่าน `https://res.cloudinary.com/<cloud>/image/upload/...` สำหรับใครก็ตามที่รู้ URL
- public ID เป็นแบบ deterministic และอ่านความหมายได้ (เช่น `.../brand/logo-mark`) จึงเดา URL ได้
- `noindex` ของเว็บต้นแบบไม่มีผลกับไฟล์ใน Cloudinary
- ผู้ที่เข้าถึง Media Library ของบัญชีได้จะเห็นไฟล์ทั้งหมด ไม่ว่าอยู่โฟลเดอร์ใด

**การประเมินความเสี่ยง:** ไฟล์ทั้ง 17 ไฟล์เผยแพร่อยู่บนเว็บไซต์เดิมแบบสาธารณะอยู่แล้ว และเจ้าของอนุญาตการนำไปใช้ซ้ำ การใช้ `upload` ใน staging จึงไม่เพิ่มการเปิดเผยข้อมูลใหม่ แต่มีข้อควรระวัง:

- ภาพบุคคล 7 ไฟล์ยังรอความยินยอม (tag `consent:pending`) ถ้าต้องการจำกัดการเข้าถึงระหว่างรอ ให้ตั้ง `CLOUDINARY_DELIVERY_TYPE=authenticated` (ต้องใช้ signed URL ในการแสดงผล ซึ่ง `next/image` ต้องตั้งค่าเพิ่ม) หรือ `--only` เพื่อนำเข้าเฉพาะไฟล์ที่ไม่มีบุคคลก่อน
- delivery type เป็นส่วนหนึ่งของ plan hash และเปลี่ยนภายหลังไม่ได้ถ้าไม่อัปโหลดใหม่ ควรตัดสินใจก่อน apply
- ควรเปิด **Strict transformations** ในบัญชี เพื่อไม่ให้บุคคลภายนอกสร้าง transformation ใหม่และสิ้นเปลือง bandwidth

## 5. Public ID ที่จะใช้

public ID มาจาก manifest ตายตัว แล้วย้ายไปอยู่ใต้ import root ส่วน `asset_folder` (dynamic mode) คือ path ของ public ID โดยไม่รวมชื่อไฟล์

| Manifest ID | มิติ | ไบต์ | Public ID |
|---|---|---:|---|
| `brand-logo-mark` | 192×192 | 46,071 | `sanpudam168/staging/legacy/brand/logo-mark` |
| `shrine-interior-altar` | 1600×1066 | 252,748 | `sanpudam168/staging/legacy/shrine/interior/interior-altar` |
| `shrine-front-entrance` | 1600×1066 | 236,966 | `sanpudam168/staging/legacy/shrine/exterior/front-entrance` |
| `shrine-signboard-side` | 1600×1066 | 216,232 | `sanpudam168/staging/legacy/shrine/exterior/signboard-side` |
| `surroundings-phraratchawang-police-station` | 1600×1066 | 147,128 | `sanpudam168/staging/legacy/shrine/surroundings/phraratchawang-police-station` |
| `shrine-pu-dam-168-statue` | 1254×1254 | 175,864 | `sanpudam168/staging/legacy/shrine/sacred-objects/pu-dam-168-statue` |
| `shrine-tra-phaendin-coat-of-arms` | 1066×1600 | 334,728 | `sanpudam168/staging/legacy/shrine/sacred-objects/tra-phaendin-coat-of-arms` |
| `item-coin-charoenlap-charoenyot-poster` | 1600×1131 | 229,362 | `sanpudam168/staging/legacy/sacred-items/coin-charoenlap-charoenyot/poster` |
| `shrine-devotee-at-coat-of-arms` | 1108×1477 | 77,650 | `sanpudam168/staging/legacy/shrine/devotees/devotee-at-coat-of-arms` |
| `event-2569-03-16-newsletter-a` | 1131×1600 | 348,064 | `sanpudam168/staging/legacy/events/2569-03-16-tra-phaendin-ceremony-newsletter-a` |
| `event-2569-03-16-newsletter-b` | 1131×1600 | 376,848 | `sanpudam168/staging/legacy/events/2569-03-16-tra-phaendin-ceremony-newsletter-b` |
| `event-officer-paying-respect` | 1567×1045 | 449,552 | `sanpudam168/staging/legacy/events/officer-paying-respect-coat-of-arms` |
| `event-monks-holy-water` | 1600×1066 | 446,046 | `sanpudam168/staging/legacy/events/monks-holy-water-coat-of-arms` |
| `event-monk-blessing-ceremony` | 1600×1068 | 163,294 | `sanpudam168/staging/legacy/events/monk-blessing-ceremony` |
| `event-monk-blessing-devotees` | 1600×1066 | 279,180 | `sanpudam168/staging/legacy/events/monk-blessing-devotees` |
| `editorial-tra-phaendin-infographic` | 1131×1600 | 234,406 | `sanpudam168/staging/legacy/editorial/infographics/tra-phaendin-infographic` |
| `brand-og-default` | 1200×630 | 172,321 | `sanpudam168/staging/legacy/brand/og-default` |

**Metadata ที่แนบกับแต่ละไฟล์**

- tags: `sanpudam168`, `source:legacy-site`, `category:<หมวด>`, `phase:02.5.4` และ `consent:pending` สำหรับภาพบุคคล 7 ไฟล์
- context: `manifest_id`, `sha256`, `source_url`, `original_filename`, `alt` (alt ที่ละเอียดที่สุดจากต้นทาง)

## 6. Idempotency

แต่ละไฟล์ทำตามลำดับนี้:

1. **ตรวจไฟล์ในเครื่อง** (ทั้งชุดก่อนเริ่ม) ถ้ามีไฟล์ใดไม่ผ่าน จะไม่มีการเรียก Cloudinary เลย
2. **ตรวจ folder mode ของบัญชี** ด้วย Admin API `GET config?settings=true` (อ่านอย่างเดียว) ถ้าไม่ตรงกับ `CLOUDINARY_FOLDER_MODE` จะหยุดก่อนเรียกคำสั่งอื่น
3. **อ่าน asset ปลายทาง** ด้วย Admin API (`GET resources/image/<type>/<public_id>`, อ่านอย่างเดียว)
   - ไม่มี → อัปโหลด
   - มีอยู่ และตรงกับไฟล์ในเครื่อง → `already_present` (ข้าม ไม่สร้างซ้ำ) เกณฑ์ "ตรงกัน" คือ `bytes`, `width`, `height` เท่ากัน และ hash ตรงกัน: ใช้ `etag` (MD5) ถ้า response มี มิฉะนั้นใช้ `sha256` ใน context ที่ importer ใส่ไว้ตอนอัปโหลด (**Admin API แบบ get resource ไม่คืนค่า `etag`** ตรวจพบตอนนำเข้าจริง ดู §12.4)
   - มีอยู่ แต่ไม่ตรง → `conflict` (ไม่เขียนทับ รายงานให้คนตัดสินใจ)
4. **อัปโหลด** ด้วย `overwrite=false`, `unique_filename=false`, `use_filename=false` ถ้ามีไฟล์ถูกสร้างขึ้นระหว่างนั้น Cloudinary จะคืน asset เดิมพร้อม `existing: true` และ importer ตรวจซ้ำว่าตรงกันหรือเป็น conflict
5. **ตรวจหลังอัปโหลด** `etag` จาก upload response = MD5 ในเครื่อง, `bytes` และมิติตรงกัน มิฉะนั้นเป็น `verify_failed`
6. **บันทึก state** ลง `migration/reports/cloudinary-import-state.json` หลังทุกไฟล์ และ log JSONL ต่อการรัน การรันซ้ำหลังหยุดกลางทางจะทำต่อได้ เพราะไฟล์ที่อัปโหลดแล้วจะได้ `already_present`

การ retry: HTTP 408/420/429/5xx และข้อผิดพลาดเครือข่าย retry สูงสุด 4 ครั้งแบบ exponential backoff และเคารพ `Retry-After` การ retry การอัปโหลดปลอดภัยเพราะ public ID ตายตัวและ `overwrite=false`

**ผลการทดสอบกับ mock server** (`node --test migration/scripts/tests/cloudinary.test.mjs`, 8/8 ผ่าน) mock จำลองพฤติกรรมจริงของ Admin API คือไม่คืน `etag` แต่คืน tags และ context:

| สถานการณ์ | ผลที่คาด | ผล |
|---|---|---|
| ลายเซ็นตามตัวอย่างในเอกสาร Cloudinary | `bfd09f95…583e` | ผ่าน |
| plan hash ผิด | exit 1 ไม่มีการอัปโหลด | ผ่าน |
| import root ไม่ใช่ staging | exit 1 ไม่มีการอัปโหลด | ผ่าน |
| apply ครั้งแรก | อัปโหลด 17 ลายเซ็นถูกทุกคำขอ `overwrite=false` ทุกคำขอ | ผ่าน |
| folder mode ของบัญชีไม่ตรงกับที่ตั้งค่า | exit 1 ไม่มีการอัปโหลด | ผ่าน |
| apply ครั้งที่สอง (ตรวจด้วย context SHA-256) | `already_present` 17 ไม่มีการอัปโหลดเพิ่ม | ผ่าน |
| asset ปลายทางถูกแก้ให้ต่างจากต้นฉบับ | `conflict` 1, exit 2 และ asset ไม่ถูกเขียนทับ | ผ่าน |
| HTTP 429 | retry แล้วสำเร็จ | ผ่าน |
| error ที่มี key/secret | ข้อความถูก redact | ผ่าน |
| ผลลัพธ์ทุกไฟล์ | ไม่มี key/secret ปรากฏ | ผ่าน |

## 7. การจัดการ conflict

- conflict ไม่ถูกแก้อัตโนมัติ และไม่มีตัวเลือก overwrite ใน importer
- ทางแก้ (ต้องให้ผู้ดูแลตัดสินใจ): (1) ตรวจว่า asset ที่มีอยู่คืออะไรและมาจากไหน (2) ถ้าเป็นไฟล์ที่ไม่ต้องการ ให้ผู้ดูแลลบใน Cloudinary console ด้วยมือ แล้วรันใหม่ หรือ (3) ใช้ import root อื่น (ซึ่งจะเปลี่ยน plan hash)
- รายการ `failed` (เช่น เครือข่ายล้มเหลวเกิน retry) รันซ้ำได้ทันที รายการ `verify_failed` ต้องตรวจก่อนรันซ้ำ เพราะ asset ถูกสร้างแล้วแต่ไม่ตรงกับไฟล์ในเครื่อง

## 8. ข้อมูลสำหรับ `media_assets`

หลัง `--apply` importer เขียน `migration/manifests/cloudinary-assets.json` (gitignored) หนึ่งเรคอร์ดต่อไฟล์ ตามรูปแบบ `mongodb-schema-spec.md` §3.12:

- `manifestId`, `category`, `resourceType`
- `cloudinary`: `assetId`, `publicId`, `version`, `secureUrl`, `resourceType`, `type`, `format`, `width`, `height`, `bytes`, `etag`, `createdAt`
- `width`, `height`, `bytes`, `mimeType`, `contentHash` (`sha256`, `md5`, `dhash`)
- `defaultAlt`, `source` (`url`, `originalFilename`, `localPath`, `pages`), `legacy.references` (legacy record IDs)
- `rights`: `status: "approved"` (เจ้าของอนุญาตการนำไปใช้ซ้ำ), `containsIdentifiablePeople`, `consent.status` (`pending` สำหรับภาพบุคคล 7 ไฟล์)
- `approval.status: "pending"` (การอนุมัติเผยแพร่ในระบบใหม่), `importedAt`, `migration.runId`

ข้อมูลนี้ใช้ในเฟสนำเข้า MongoDB ต่อไป (ยังไม่เชื่อมต่อ MongoDB ในเฟสนี้)

## 9. Remote preflight

`--preflight` ต้องใช้ API key/secret เพราะ Admin API ต้องยืนยันตัวตน แม้จะเป็นการอ่านอย่างเดียว ใช้คำขอ 18 ครั้ง (config 1 + get resource 17 นับรวมใน Admin API rate limit) และไม่เขียนอะไร ผลที่ได้: แต่ละ public ID เป็น `would_upload`, `already_present` หรือ `conflict` ควรรันก่อน `--apply` ทุกครั้ง ผลจริงอยู่ใน §12.2

## 10. Rollback

- importer **ไม่ลบไฟล์** ทุกกรณี
- ถ้าต้องยกเลิกการนำเข้า staging: ผู้ดูแลลบด้วยมือใน Cloudinary console หรือ Admin API โดยเลือกเฉพาะ prefix `sanpudam168/staging/legacy/` หรือ tag `phase:02.5.4` หลังยืนยันว่าไม่มีเนื้อหาใดอ้างอิงแล้ว
- ไฟล์ต้นฉบับใน `migration/assets/` และ manifest ยังอยู่ครบ จึงอัปโหลดใหม่ได้ทุกเมื่อ
- หลังลบ asset ให้ลบ `migration/reports/cloudinary-import-state.json` และ `migration/manifests/cloudinary-assets.json` ในเครื่อง เพื่อไม่ให้ state เก่าค้าง (การรันใหม่จะตรวจกับ Cloudinary จริงเสมอ จึงไม่พึ่ง state)
- ถ้าบัญชีเปิด Backup ไว้ ไฟล์ที่ลบจะกู้คืนได้ตามนโยบายของบัญชี

## 11. การตรวจหลังอัปโหลด

1. ผลการรันต้องเป็น `uploaded` (หรือ `already_present`) 17 รายการ ไม่มี `conflict`/`failed`/`verify_failed`
2. รัน `--preflight` อีกครั้ง ต้องได้ `already_present` 17 รายการ (ยืนยัน idempotency กับบริการจริง)
3. ตรวจใน Media Library ว่าทุกไฟล์อยู่ใต้ `sanpudam168/staging/legacy/` มี tags และ context ครบ
4. เปิด `secureUrl` ของแต่ละไฟล์ ต้องได้ HTTP 200 และ content type ตรงกับ `format`
5. ตรวจด้วยตาอย่างน้อย: โลโก้ (192×192 ไม่ถูกขยาย), ภาพแบนเนอร์ 1 ภาพ, โปสเตอร์เหรียญ และจดหมายข่าว 1 ฉบับ
6. เทียบ `migration/manifests/cloudinary-assets.json` กับ `media-manifest.json` ว่า `etag` = `md5` ทุกรายการ
7. บันทึกผลใน `docs/migration-validation-checklist.md` §5

## 12. ผลการนำเข้า staging (29 ตุลาคม 2569)

### 12.1 การอนุมัติและการตั้งค่า

- เจ้าของอนุมัติ **Option A**: อัปโหลดทั้ง 17 ไฟล์แบบ public (`upload`) รวมภาพบุคคล 7 ไฟล์ที่เจ้าของอนุญาตให้ใช้ซ้ำและเผยแพร่แบบสาธารณะ
- ค่าที่ใช้ (อ่านจาก `.env.local` ผ่าน `node --env-file` แสดงเฉพาะค่าที่ไม่ใช่ความลับ): cloud ตาม `CLOUDINARY_CLOUD_NAME`, import root `sanpudam168/staging/legacy` (ค่าเริ่มต้น ไม่ได้ override), delivery type `upload`, folder mode `dynamic` (**ยืนยันกับบัญชีแล้ว** ผ่าน Admin API config), API ของ Cloudinary จริง, ผ่าน staging check และไม่มี namespace production
- credentials ไม่ถูกพิมพ์ในผลลัพธ์ใด ๆ

### 12.2 ลำดับการรันและผล

| ขั้น | คำสั่ง | ผล |
|---|---|---|
| ตรวจไฟล์ต้นฉบับ | `verify-media.mjs` | 17/17 ผ่าน (SHA-256, ขนาด, รูปแบบ, มิติ) 4,186,460 ไบต์ |
| Preflight ก่อนอัปโหลด | `--preflight` | folder mode บัญชี = `dynamic`, `would_upload` 17, ไม่มี asset เดิม ไม่มี conflict |
| Dry run ด้วยค่าจริง | (ค่าเริ่มต้น) | 17 ไฟล์ที่อนุมัติทั้งหมด อยู่ใต้ root ที่อนุมัติ ไม่มีไฟล์หรือปลายทางอื่น |
| อัปโหลด | `--apply --plan-hash=…` | **uploaded 17**, already_present 0, conflict 0, failed 0, verify_failed 0 |
| ตรวจหลังอัปโหลด | `verify-cloudinary.mjs` | **17/17 ผ่าน** |
| Preflight หลังอัปโหลด | `--preflight` | **already_present 17** (ยืนยัน idempotency กับบริการจริง) |

Plan hash ที่ใช้ (เต็ม): `a938cb7e381fbbc4c8f9b34a6121ef1cb0701fe644db874b702ebee67342e806`

### 12.3 ผลการตรวจหลังอัปโหลด

ทุกไฟล์ผ่านทุกข้อ:

- Admin API: พบ asset, asset ID ตรงกับที่บันทึกตอนอัปโหลด, public ID ตรงกับแผน, delivery type `upload`, รูปแบบ (webp 15, png 1, jpg 1), มิติและขนาดไบต์ตรงกับต้นฉบับ, tags และ context `sha256` ครบ, `asset_folder` ถูกต้อง
- MD5 จาก upload response ตรงกับต้นฉบับทั้ง 17 ไฟล์
- **การส่งแบบสาธารณะ:** ดาวน์โหลด secure URL โดยไม่ใช้ credentials ได้ HTTP 200 ทั้ง 17 ไฟล์ content type ถูกต้อง และ **SHA-256 ของไฟล์ที่ส่งออกตรงกับต้นฉบับทุกไบต์** (Cloudinary เก็บและส่งต้นฉบับโดยไม่บีบอัดหรือแก้ไข รวมถึงโลโก้ 192×192)

### 12.4 ข้อบกพร่องที่พบและแก้ระหว่างนำเข้า

การตรวจหลังอัปโหลดครั้งแรกรายงาน "etag differs" ทั้ง 17 ไฟล์ สาเหตุคือ **Admin API แบบ get resource ไม่คืนฟิลด์ `etag`** (มีเฉพาะใน upload response) ไฟล์จริงถูกต้องทุกไฟล์ (ไบต์ที่ส่งสาธารณะตรงกับต้นฉบับ) แต่ตรรกะเดิมของ importer ใช้ `etag` จาก get resource ตัดสินว่าข้ามได้หรือไม่ ซึ่งจะทำให้การรันซ้ำรายงาน asset ที่ถูกต้องเป็น **conflict** แทน `already_present` แก้แล้วโดย:

- importer: ใช้ `etag` เมื่อมี มิฉะนั้นใช้ `context.custom.sha256` ร่วมกับขนาดและมิติ
- verifier: ใช้ MD5 จาก upload response และ SHA-256 ของไบต์ที่ส่งสาธารณะ
- mock server ในการทดสอบ: ไม่คืน `etag` ใน get resource เหมือนบริการจริง เพื่อให้การทดสอบจับปัญหาแบบนี้ได้

หลังแก้ preflight กับบริการจริงได้ `already_present` 17 ตามที่ควรเป็น ระหว่างนี้ไม่มีการอัปโหลดซ้ำหรือเขียนทับใด ๆ

### 12.5 Public ID และ asset ID สุดท้าย

| Manifest ID | Cloudinary asset ID | Public ID |
|---|---|---|
| `brand-logo-mark` | `dd39aaeda36e2b7cf3d25b44f32c3399` | `sanpudam168/staging/legacy/brand/logo-mark` |
| `shrine-interior-altar` | `f2f10bcc5bdb54d49cd255829b905fde` | `sanpudam168/staging/legacy/shrine/interior/interior-altar` |
| `shrine-front-entrance` | `8650edfdf0e872e72f10715cfe32a7f5` | `sanpudam168/staging/legacy/shrine/exterior/front-entrance` |
| `shrine-signboard-side` | `87fb63ec380825690021efcb867a235c` | `sanpudam168/staging/legacy/shrine/exterior/signboard-side` |
| `surroundings-phraratchawang-police-station` | `c919aafb0289a241f16070784727d924` | `sanpudam168/staging/legacy/shrine/surroundings/phraratchawang-police-station` |
| `shrine-pu-dam-168-statue` | `8a388fe2b72f3cca1e934afbee70c47c` | `sanpudam168/staging/legacy/shrine/sacred-objects/pu-dam-168-statue` |
| `shrine-tra-phaendin-coat-of-arms` | `432d4abe111ad056fe21cbd616e0dfef` | `sanpudam168/staging/legacy/shrine/sacred-objects/tra-phaendin-coat-of-arms` |
| `item-coin-charoenlap-charoenyot-poster` | `0c36fbc6354e13ff291b523264eb050e` | `sanpudam168/staging/legacy/sacred-items/coin-charoenlap-charoenyot/poster` |
| `shrine-devotee-at-coat-of-arms` | `3b307d5d420fa255916facfd468f60f3` | `sanpudam168/staging/legacy/shrine/devotees/devotee-at-coat-of-arms` |
| `event-2569-03-16-newsletter-a` | `29d9a5082e18daa0caa317f04e862e59` | `sanpudam168/staging/legacy/events/2569-03-16-tra-phaendin-ceremony-newsletter-a` |
| `event-2569-03-16-newsletter-b` | `4d2714e6bb777a40f449ca2627a1f753` | `sanpudam168/staging/legacy/events/2569-03-16-tra-phaendin-ceremony-newsletter-b` |
| `event-officer-paying-respect` | `aebd71b63f136efb2f0617ad5316210b` | `sanpudam168/staging/legacy/events/officer-paying-respect-coat-of-arms` |
| `event-monks-holy-water` | `e6e157316a434b5b3601845970cbe268` | `sanpudam168/staging/legacy/events/monks-holy-water-coat-of-arms` |
| `event-monk-blessing-ceremony` | `9f94c5fc97ce8e478368e48c8beb55c9` | `sanpudam168/staging/legacy/events/monk-blessing-ceremony` |
| `event-monk-blessing-devotees` | `0ccdaedac50f4b9139c68b5666ec9fc6` | `sanpudam168/staging/legacy/events/monk-blessing-devotees` |
| `editorial-tra-phaendin-infographic` | `513166726f5317c5a86f0c6de075749f` | `sanpudam168/staging/legacy/editorial/infographics/tra-phaendin-infographic` |
| `brand-og-default` | `884f5127a9938f5d7d7b3b7c1591dfa8` | `sanpudam168/staging/legacy/brand/og-default` |

secure URL ทุกไฟล์มีรูปแบบ `https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public ID>.<format>` ค่าเต็มอยู่ในรายงานในเครื่อง (ไม่ commit)

### 12.6 Mapping สำหรับ `media_assets`

`node migration/scripts/build-media-mapping.mjs` สร้าง `migration/manifests/media-assets-mapping.json` (gitignored) 17 รายการ แต่ละรายการมี: source URL เดิม, legacy media URL (ไฟล์ต้นฉบับและไฟล์ `-800` ที่ CMS เดิมใช้), legacy references (`<collection>:<legacyId>:<field>`), checksum ของไฟล์ในเครื่อง (SHA-256, MD5, dHash), Cloudinary asset ID, public ID, secure URL, version, format, width/height, bytes, alt หลัก, rights/consent, เวลานำเข้า และ **suggested associations 31 รายการ** (collection, `importId` ของเอกสารเนื้อหา, legacy ID, field path, alt/caption/focal point ระดับการใช้งาน)

โลโก้ไม่มีการอ้างอิงใน CMS เดิม จึงเพิ่ม association ที่วางแผนไว้ `site_settings.branding.logo` พร้อมหมายเหตุ ไม่มี asset ใดที่ไม่มี association

### 12.7 ไฟล์ที่สร้างในเครื่อง (ไม่ commit)

- `migration/manifests/cloudinary-assets.json` — ผลการนำเข้า (รูปแบบ media_assets)
- `migration/manifests/media-assets-mapping.json` — mapping สุดท้ายพร้อม associations
- `migration/reports/cloudinary-import-state.json` — state สำหรับ resume
- `migration/reports/cloudinary-import-<runId>.jsonl` — log ต่อการรัน
- `migration/reports/cloudinary-dry-run.{json,md}`, `cloudinary-verification.{json,md}`, `cloudinary-import-result.md`

### 12.8 งานที่เหลือ

1. **MongoDB (ต้องได้รับอนุมัติแยก):** เพิ่ม `mongoose`, สร้าง model ตาม `mongodb-schema-spec.md`, นำเข้า `media_assets` 17 รายการ แล้วนำเข้าเนื้อหา 39 รายการเป็น `draft / pending_review` โดยผูก ImageRef ด้วย mapping นี้
2. ตั้งค่า `images.remotePatterns` สำหรับ `res.cloudinary.com` ใน `next.config.mjs` เมื่อเริ่มแสดงภาพจาก Cloudinary
3. พิจารณาเปิด **Strict transformations** ในบัญชี Cloudinary
4. ขอไฟล์โลโก้ความละเอียดสูงจากเจ้าของ (ถ้ามี) และลิงก์ Google Maps รูปแบบที่ระบบรองรับ
5. การย้ายไป namespace production ต้องได้รับอนุมัติแยก (`--target=production --confirm-root=…`)
