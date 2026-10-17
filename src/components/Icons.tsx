import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

/** Liftoff's rocket. Drawn pointing up; the flame uses the accent color. */
export function RocketGlyph({ size = 24, flame = true, ...rest }: P & { flame?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
      {flame && (
        <path className="rocket-flame" d="M10 17.2h4l-.7 2.9L12 22.6l-1.3-2.5z" fill="var(--accent)" />
      )}
      <path d="M7.6 12.4 4.9 15.6v2.6l2.7-1.5z" fill="currentColor" opacity=".75" />
      <path d="M16.4 12.4l2.7 3.2v2.6l-2.7-1.5z" fill="currentColor" opacity=".75" />
      <path d="M12 1.6c3.1 2.6 4.6 6.2 4.6 10.8v4.8H7.4v-4.8c0-4.6 1.5-8.2 4.6-10.8z" fill="currentColor" />
      <circle cx="12" cy="9.4" r="1.9" fill="var(--rocket-window, #fff)" />
    </svg>
  );
}

export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

export const AlertIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 8v5M12 16.5v.5" />
    <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);

export const DocIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const PhoneIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

export const SpeakerIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const StopIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const CloseIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CopyIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const CameraIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const ArrowIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const GlobeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9z" />
  </svg>
);
