import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false,
});

export const IconCheck = ({ size, ...p }: P) => <svg {...base(size)} {...p}><polyline points="4.5,12.8 9.6,17.6 19.5,6.2" /></svg>;
export const IconBack = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M19 12H5M10.5 6.5 5 12l5.5 5.5" /></svg>;
export const IconNext = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" /></svg>;
export const IconCamera = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.6" r="3.4" /></svg>;
export const IconClose = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconPin = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>;
export const IconPlus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconFile = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
export const IconShare = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" /><path d="M5 11v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></svg>;
export const IconDownload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" /></svg>;
export const IconRefresh = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></svg>;
export const IconSnow = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" /><path d="M9.5 4 12 6.2 14.5 4M9.5 20 12 17.8 14.5 20M4.6 10.6l3.1-1-.6-3.2M19.4 13.4l-3.1 1 .6 3.2M4.6 13.4l3.1 1-.6 3.2M19.4 10.6l-3.1-1 .6-3.2" /></svg>;
export const IconClock = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconGrid = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M14.5 16.5l1.8 1.8 3.2-3.6" /></svg>;
export const IconGrain = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 4h8l1 4H7z" /><path d="M7 8l-1 11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1L17 8" /><path d="M10 12.5h.01M14 12.5h.01M12 15.5h.01M10 17.5h.01M14 17.5h.01" strokeWidth={2.4} /></svg>;
export const IconTemp = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M10 4.5a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z" /><path d="M12 10v6" /></svg>;
export const IconPen = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M15.5 4.5l4 4L9 19H5v-4z" /><path d="M13 7l4 4" /></svg>;
export const IconShield = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12.2l2.2 2.2 4.3-4.6" /></svg>;
export const IconWifiOff = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 3l18 18M8.5 16.2a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.4M19 12.6a10 10 0 0 0-2.6-1.8M2 9a15 15 0 0 1 4.5-2.8M22 9a15 15 0 0 0-10-3.9" /><circle cx="12" cy="19.5" r=".6" fill="currentColor" /></svg>;
export const IconChevron = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M9 6l6 6-6 6" /></svg>;
