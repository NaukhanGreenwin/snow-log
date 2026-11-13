import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false,
});

export const IconCheck = ({ size, ...p }: P) => <svg {...base(size)} {...p}><polyline points="4.5,12.8 9.6,17.6 19.5,6.2" /></svg>;
export const IconBack = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M19 12H5M10.5 6.5 5 12l5.5 5.5" /></svg>;
export const IconNext = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" /></svg>;
export const IconCamera = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.2" r="3.6" /></svg>;
export const IconClose = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconPin = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>;
export const IconPlus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconFile = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
export const IconShare = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" /><path d="M5 11v10h14V11" /></svg>;
export const IconDownload = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" /></svg>;
export const IconRefresh = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></svg>;
