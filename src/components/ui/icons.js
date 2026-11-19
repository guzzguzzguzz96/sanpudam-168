// Decorative line icons. Every icon is aria-hidden; pair it with visible text.
const paths = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  chat: (
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
  ),
  book: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5Z" />
    </>
  ),
  lotus: (
    <>
      <path d="M12 19c-2.5-2-3.5-4.5-3.5-7S10 7 12 5c2 2 3.5 4.5 3.5 7s-1 5-3.5 7Z" />
      <path d="M12 19c-3.5 0-7-2-8-6 2.5-.5 5 0 6.5 1.5" />
      <path d="M12 19c3.5 0 7-2 8-6-2.5-.5-5 0-6.5 1.5" />
    </>
  ),
  gem: (
    <>
      <path d="M7 4.5h10l3.5 5L12 20 3.5 9.5Z" />
      <path d="M3.5 9.5h17M9.5 4.5 8 9.5l4 10.5 4-10.5-1.5-5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  external: (
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10" />
  ),
  // Worship step icons (same 24px line style).
  flame: (
    <>
      <path d="M12 20.5c-3.6 0-6-2.4-6-5.6 0-3.6 3-5.5 3.5-9.4 2.3 1.4 3.4 3.6 3.2 6 1-.6 1.6-1.6 1.8-2.8 2 1.6 3.5 3.8 3.5 6.2 0 3.2-2.4 5.6-6 5.6Z" />
      <path d="M12 20.5c-1.4 0-2.5-1-2.5-2.5 0-1.6 1.3-2.4 2.5-4 1.2 1.6 2.5 2.4 2.5 4 0 1.5-1.1 2.5-2.5 2.5Z" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 4.5h10.5a2 2 0 0 1 2 2V8h-4" />
      <path d="M15.5 6.5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V16h9.5" />
      <path d="M7 4.5a2 2 0 0 0-2 2V16M9 9h4M9 12.5h4" />
    </>
  ),
  gift: (
    <>
      <path d="M4 9h16v3.5H4Z" />
      <path d="M5.5 12.5V20h13v-7.5M12 9v11" />
      <path d="M12 9c-1-2.5-2.5-4-4-4a2 2 0 0 0 0 4M12 9c1-2.5 2.5-4 4-4a2 2 0 0 1 0 4" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="10" r="2.25" />
      <path d="M12 7.75C12 5.5 13 4 14.25 4s2 1.5 1 3.25M14.25 10c2.25 0 3.75 1 3.75 2.25s-1.5 2-3.25 1M12 12.25c0 2.25-1 3.75-2.25 3.75s-2-1.5-1-3.25M9.75 10C7.5 10 6 9 6 7.75s1.5-2 3.25-1" />
      <path d="M12 12.25V20.5M12 18c1.5-1.5 3-2 4.5-2M12 18.5c-1.25-1-2.5-1.5-3.75-1.5" />
    </>
  ),
};

export function Icon({ name, className = "", size = 24 }) {
  return (
    <svg
      aria-hidden="true"
      className={`ui-icon ${className}`.trim()}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}
