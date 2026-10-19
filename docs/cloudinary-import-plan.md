# แผนนำเข้าสื่อไป Cloudinary (Cloudinary Import Plan)

**Phase:** 02.5.4 — Cloudinary Media Import Preparation
**วันที่:** 19 ตุลาคม 2569 (2026-10-19)
**สถานะ:** importer และการทดสอบพร้อมแล้ว รัน dry-run แบบออฟไลน์แล้ว **ยังไม่มีการอัปโหลดจริง** และยังไม่ได้ทำ remote preflight การรัน `--apply` ต้องได้รับอนุมัติจากผู้ใช้ก่อน

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
2. **อ่าน asset ปลายทาง** ด้วย Admin API (`GET resources/image/<type>/<public_id>`, อ่านอย่างเดียว)
   - ไม่มี → อัปโหลด
   - มีอยู่ และ `etag` (MD5) กับ `bytes` ตรงกับไฟล์ในเครื่อง → `already_present` (ข้าม ไม่สร้างซ้ำ)
   - มีอยู่ แต่ไม่ตรง → `conflict` (ไม่เขียนทับ รายงานให้คนตัดสินใจ)
3. **อัปโหลด** ด้วย `overwrite=false`, `unique_filename=false`, `use_filename=false` ถ้ามีไฟล์ถูกสร้างขึ้นระหว่างนั้น Cloudinary จะคืน asset เดิมพร้อม `existing: true` และ importer ตรวจซ้ำว่าตรงกันหรือเป็น conflict
4. **ตรวจหลังอัปโหลด** `etag` = MD5 ในเครื่อง, `bytes` และมิติตรงกัน มิฉะนั้นเป็น `verify_failed`
5. **บันทึก state** ลง `migration/reports/cloudinary-import-state.json` หลังทุกไฟล์ และ log JSONL ต่อการรัน การรันซ้ำหลังหยุดกลางทางจะทำต่อได้ เพราะไฟล์ที่อัปโหลดแล้วจะได้ `already_present`

การ retry: HTTP 408/420/429/5xx และข้อผิดพลาดเครือข่าย retry สูงสุด 4 ครั้งแบบ exponential backoff และเคารพ `Retry-After` การ retry การอัปโหลดปลอดภัยเพราะ public ID ตายตัวและ `overwrite=false`

**ผลการทดสอบกับ mock server** (`node --test migration/scripts/tests/cloudinary.test.mjs`, 8/8 ผ่าน):

| สถานการณ์ | ผลที่คาด | ผล |
|---|---|---|
| ลายเซ็นตามตัวอย่างในเอกสาร Cloudinary | `bfd09f95…583e` | ผ่าน |
| plan hash ผิด | exit 1 ไม่มีการอัปโหลด | ผ่าน |
| import root ไม่ใช่ staging | exit 1 ไม่มีการอัปโหลด | ผ่าน |
| apply ครั้งแรก | อัปโหลด 17 ลายเซ็นถูกทุกคำขอ `overwrite=false` ทุกคำขอ | ผ่าน |
| apply ครั้งที่สอง | `already_present` 17 ไม่มีการอัปโหลดเพิ่ม | ผ่าน |
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

## 9. Remote preflight (ยังไม่ได้รัน)

`--preflight` ต้องใช้ API key/secret เพราะ Admin API "get resource" ต้องยืนยันตัวตน แม้จะเป็นการอ่านอย่างเดียว ใช้คำขอ 17 ครั้ง (นับรวมใน Admin API rate limit ของบัญชี) และไม่เขียนอะไร ผลที่ได้: แต่ละ public ID เป็น `would_upload`, `already_present` หรือ `conflict` เฟสนี้ **ไม่ได้รัน** เพราะต้องอ่าน `.env.local` ซึ่งไม่ได้รับอนุญาตในเฟสนี้ แนะนำให้รัน preflight ก่อน `--apply` ทุกครั้ง

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
