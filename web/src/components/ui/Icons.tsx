import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return <Svg {...props}><path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></Svg>;
}

export function LayersIcon(props: IconProps) {
  return <Svg {...props}><path d="m12 3 9 5-9 5-9-5 9-5Zm9 10-9 5-9-5m18 5-9 5-9-5" /></Svg>;
}

export function EyeIcon({ hidden = false, ...props }: IconProps & { hidden?: boolean }) {
  return hidden ? (
    <Svg {...props}><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.6 10.6 0 0 1 12 4c5.2 0 9 5 9 5a17 17 0 0 1-2.1 2.6M6.2 6.2C4.2 7.5 3 9 3 9s3.8 5 9 5c1 0 2-.2 2.8-.5" /></Svg>
  ) : (
    <Svg {...props}><path d="M3 12s3.8-5 9-5 9 5 9 5-3.8 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.5" /></Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function CrosshairIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></Svg>;
}

export function MapPinIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></Svg>;
}

export function TrashIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></Svg>;
}

export function RestoreIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 4v6h6M5 10a8 8 0 1 1 2.3 6.7" /></Svg>;
}

export function ChevronIcon({ open = false, ...props }: IconProps & { open?: boolean }) {
  return <Svg className={open ? "chevron chevron-open" : "chevron"} {...props}><path d="m8 10 4 4 4-4" /></Svg>;
}

export function CopyIcon(props: IconProps) {
  return <Svg {...props}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>;
}

export function MoreIcon(props: IconProps) {
  return <Svg {...props}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Svg>;
}

export function EditIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></Svg>;
}

export function RefreshIcon(props: IconProps) {
  return <Svg {...props}><path d="M20 7v5h-5M4 17v-5h5M6.1 8.2A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 11.9-1.2" /></Svg>;
}

export function CloseIcon(props: IconProps) {
  return <Svg {...props}><path d="m6 6 12 12M18 6 6 18" /></Svg>;
}


export function DownloadIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></Svg>;
}

export function UploadIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M5 20h14" /></Svg>;
}

export function DatabaseIcon(props: IconProps) {
  return <Svg {...props}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></Svg>;
}

export function FileCodeIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v5h5" /><path d="m10 12-2 2 2 2m4-4 2 2-2 2" /></Svg>;
}

export function LocationIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2.2" /></Svg>;
}

export function RulerIcon(props: IconProps) {
  return <Svg {...props}><path d="m4 16 12-12 4 4L8 20H4Z" /><path d="m12 8 2 2m-5 1 2 2m-5 1 2 2" /></Svg>;
}

export function LandIcon(props: IconProps) {
  return <Svg {...props}><path d="M3 17 8 8l4 5 3-4 6 8" /><path d="M3 20h18" /></Svg>;
}
