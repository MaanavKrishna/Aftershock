import type { SVGProps } from "react";

/** A small inline icon set (24px grid, 1.75 stroke, currentColor). Decorative unless given a `title`. */
type P = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size = 16, title, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} {...rest}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const Check = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const Cross = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const Half = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" /></Svg>;
export const Ring = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="7.5" /></Svg>;
export const Dashed = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="7.5" strokeDasharray="3 3" /></Svg>;
export const Pencil = (p: P) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></Svg>;
export const Wave = (p: P) => <Svg {...p}><path d="M2 12h3l2-6 3 12 3-9 2 3h7" /></Svg>;
export const Clock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const Spinner = (p: P) => <Svg {...p} className={`animate-spin motion-reduce:animate-none ${p.className ?? ""}`}><path d="M12 3a9 9 0 1 0 9 9" /></Svg>;
export const Progress = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="7.5" strokeOpacity={0.35} /><path d="M12 4.5a7.5 7.5 0 0 1 7.5 7.5" /></Svg>;
export const Bell = (p: P) => <Svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const Download = (p: P) => <Svg {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>;
export const ArrowRight = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const ChevronRight = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const ChevronDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const Search = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>;
export const Plus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const Menu = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const Shield = (p: P) => <Svg {...p}><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const Commit = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3.5" /><path d="M2 12h6.5M15.5 12H22" /></Svg>;
export const PullRequest = (p: P) => <Svg {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7M18 15.5V9a3 3 0 0 0-3-3h-4m0 0 2.5-2.5M11 6l2.5 2.5" /></Svg>;
export const Branch = (p: P) => <Svg {...p}><circle cx="6" cy="5.5" r="2.5" /><circle cx="6" cy="18.5" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8v8M18 10.5c0 4-6 3-11 6" /></Svg>;
export const Bolt = (p: P) => <Svg {...p}><path d="M13 3 5 13.5h6L10 21l9-11h-6z" /></Svg>;
export const Memory = (p: P) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 12h8M8 15h5" /></Svg>;
export const Chart = (p: P) => <Svg {...p}><path d="M4 20V4M4 20h16" /><path d="m7 15 4-4 3 3 5-6" /></Svg>;
export const Gear = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1" /></Svg>;
export const Plug = (p: P) => <Svg {...p}><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" /></Svg>;
export const Repo = (p: P) => <Svg {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></Svg>;
export const Home = (p: P) => <Svg {...p}><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /></Svg>;
export const Copy = (p: P) => <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Svg>;
export const External = (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const Sun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const Moon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>;
export const Github = (p: P) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={p.className}>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </svg>
);
