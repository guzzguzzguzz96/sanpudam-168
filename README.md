# Sanpudam 168

โครงสร้างตั้งต้นสำหรับเว็บไซต์ Sanpudam 168 ระยะที่ 01 ครอบคลุมเฉพาะพื้นฐานของโปรเจกต์และหน้าแนะนำแบบเรียบง่าย ยังไม่มีระบบแคตตาล็อก ข่าวสาร CMS หรือการยืนยันตัวตน

## เริ่มต้นใช้งาน

ต้องใช้ Node.js 20.9 ขึ้นไป และ npm

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) เพื่อดูเว็บไซต์

## คำสั่งที่ใช้บ่อย

```bash
npm run dev    # เริ่มเซิร์ฟเวอร์สำหรับพัฒนา
npm run lint   # ตรวจสอบโค้ดด้วย ESLint
npm run build  # สร้าง production build
npm start      # เริ่ม production server หลัง build
```

## โครงสร้างโปรเจกต์

```text
src/
  app/          เส้นทาง หน้าเว็บ root layout และ global styles
  components/   ส่วนประกอบ UI ที่ใช้ซ้ำ
  config/       การตั้งค่าเว็บไซต์
  lib/          utilities และโค้ดฝั่งเซิร์ฟเวอร์ที่ใช้ร่วมกัน
  models/       พื้นที่สำหรับ Mongoose models ในอนาคต
  services/     ขอบเขตการเชื่อมต่อบริการและ business logic ในอนาคต
```

หน้าและ layout ใช้ React Server Components ตามค่าเริ่มต้น และใช้ App Router ซึ่งรองรับการ render ฝั่งเซิร์ฟเวอร์ โดยไม่เปิดใช้ static export โครงสร้าง `lib`, `models` และ `services` เตรียมไว้สำหรับการต่อยอด แต่ยังไม่มีการเชื่อมต่อฐานข้อมูล บริการภายนอก หรือระบบ auth ในระยะนี้

โปรเจกต์ใช้ JavaScript/JSX, Tailwind CSS, ESLint และ alias `@/*` ที่ชี้ไปยัง `src/*` ตามที่กำหนดใน `jsconfig.json`

## Environment variables

`.env.example` แสดงเฉพาะชื่อตัวแปรที่อาจต้องใช้ในระยะถัดไป โดยยังไม่มีการอ่านค่าเหล่านี้ในแอป ให้คัดลอกเป็น `.env.local` เมื่อต้องเริ่มพัฒนาการเชื่อมต่อที่เกี่ยวข้อง และกำหนดค่าจริงเฉพาะในเครื่องหรือ secret store ที่เหมาะสม

ไฟล์ environment ส่วนตัว เช่น `.env.local` และ `.env.production` ถูกละเว้นโดย Git ส่วน `.env.example` สามารถเพิ่มเข้า repository ได้ ห้ามใส่ credentials หรือ API secrets ลงใน source code หรือไฟล์ตัวอย่าง

## ขอบเขตระยะนี้

มีเพียงหน้าแนะนำ responsive ภาษาไทย, navigation พื้นฐาน, metadata สำหรับ SEO และโครงสร้างเริ่มต้น ยังไม่มี MongoDB Atlas/Mongoose connection, Cloudinary uploads, Auth.js, ระบบ Admin หรือ public registration

## Git branching

- `main` is the production branch and should contain only stable, verified code.
- `dev` is the development and preview branch and the default base for future work. Create feature branches from `dev` and merge completed work back into `dev`.
- Release changes through a pull request from `dev` into `main`; obtain approval before merging or deploying.
- No Vercel configuration or deployment setup is included in this phase.
