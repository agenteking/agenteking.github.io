import type { JSX, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (p: P): P => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
  ...p,
});

export const LogoMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable={false}>
    <defs>
      <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8B6DFF" />
        <stop offset="1" stopColor="#5B3FD9" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill="url(#lm-g)" />
    <path d="M16 26.5s-7.6-6.3-7.6-12.4a7.6 7.6 0 0 1 15.2 0c0 6.1-7.6 12.4-7.6 12.4z" fill="#fff" />
    <path d="M16 9.9l1.15 2.95 2.95 1.15-2.95 1.15L16 18.1l-1.15-2.95L11.9 14l2.95-1.15z" fill="#6E4BF2" />
  </svg>
);

export const Search = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);
export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const Phone = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.6 3.5h2.6l1.4 4-2 1.4a11 11 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6A2.1 2.1 0 0 1 18.4 19.6 15.6 15.6 0 0 1 4.4 5.6a2.1 2.1 0 0 1 2.2-2.1z" />
  </svg>
);
export const WhatsApp = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 19.5l1.2-3.9A7.9 7.9 0 1 1 8.6 18.4z" />
    <path d="M9.3 8.6c.2-.4.6-.4.8-.4h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.7l-.5.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.5c.2-.2.5-.2.7-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.8-.6.4-1.4.5-2.1.3a7.7 7.7 0 0 1-4.9-4.9c-.2-.7-.1-1.5.4-2.2z" strokeWidth={1.3} />
  </svg>
);
export const Mail = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M4.5 7l7.5 6 7.5-6" />
  </svg>
);
export const Instagram = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <path d="M16.8 7.2h.01" strokeWidth={2.4} />
  </svg>
);
export const Facebook = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 20v-7h2.6l.4-3H14V8.3c0-.9.3-1.5 1.6-1.5H17V4.2a20 20 0 0 0-2.3-.1c-2.3 0-3.7 1.4-3.7 3.9V10H8.5v3H11v7" />
  </svg>
);
export const Store = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5l1.4-4.5h13.2L20 9.5" />
    <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
    <path d="M5.5 11.5V20h13v-8.5M10 20v-4.5h4V20" />
  </svg>
);
export const Pin = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21s-6.5-5.4-6.5-10.6a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21z" />
    <circle cx="12" cy="10.4" r="2.3" />
  </svg>
);
export const Globe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z" />
  </svg>
);
export const Star = (p: P) => (
  <svg {...base({ fill: "currentColor", stroke: "none", ...p })}>
    <path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z" />
  </svg>
);
export const Ban = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6 6l12 12" />
  </svg>
);
export const Note = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3.5h8.5L19 8v12.5H6z" />
    <path d="M14 3.5V8h5M9 12h7M9 15.5h7" />
  </svg>
);
export const Clock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const Wallet = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="7.5" width="16.5" height="12" rx="2.5" />
    <path d="M16.5 13.5h.01" strokeWidth={2.6} />
  </svg>
);
export const Users = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.8c1.7.6 2.7 2.2 3 4.7" />
  </svg>
);
export const Logout = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4.5H6.5v15H14M10 12h10M16.5 8.5L20 12l-3.5 3.5" />
  </svg>
);
export const Refresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.5 6l6 6-6 6" />
  </svg>
);
export const Sparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4l1.8 4.9L18.5 10.5l-4.7 1.7L12 17l-1.8-4.8L5.5 10.5l4.7-1.6z" />
  </svg>
);

export const CHANNEL_ICON: Record<string, (p: P) => JSX.Element> = {
  mail: Mail,
  whatsapp: WhatsApp,
  telefono: Phone,
  instagram: Instagram,
  en_comercio: Store,
  facebook: Facebook,
  otro: Note,
};
