# Sanpudam 168

โครงการ Sanpudam 168 ใช้ Next.js App Router และอยู่ระหว่างทำ Phase 02.4: Thai-focused UI/UX refinement ของ responsive homepage prototype. หน้าแรกแสดงโครงสร้างและข้อมูลตัวอย่างสำหรับการพัฒนาเท่านั้น เนื้อหา ภาพ และข้อมูลปฏิบัติการยังไม่ใช่ข้อมูลที่เจ้าของยืนยันและไม่ควรเผยแพร่เป็นข้อเท็จจริง

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

หน้า `/` เป็น homepage prototype แบบ responsive ภาษาไทย ส่วนหน้า `/history`, `/sakkara`, `/news` และ `/visit` ในเมนูยังอยู่ระหว่างการพัฒนา ลิงก์เหล่านี้จึงยังไม่ใช่หน้าที่พร้อมใช้งาน ขณะนี้ยังไม่มี MongoDB Atlas/Mongoose connection, Cloudinary uploads, Auth.js, ระบบ Admin, Contact Form หรือ public registration และ metadata ของ prototype ตั้งค่าไม่ให้เครื่องมือค้นหาจัดทำดัชนี

## Git branching

- `main` is the production branch and should contain only stable, verified code.
- `dev` is the development and preview branch and the default base for future work. Create feature branches from `dev` and merge completed work back into `dev`.
- Release changes through a pull request from `dev` into `main`; obtain approval before merging or deploying.
- No Vercel configuration or deployment setup is included in this phase.
