export default function OrigamiLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/*
          The mask punches a circle out of the center, turning each shape's
          inner corner into a concave arc — matching the origami logo visual.
        */}
        <mask id="origamiLogoMask">
          <rect width="100" height="100" fill="white" />
          <circle cx="50" cy="50" r="17" fill="black" />
        </mask>
      </defs>
      <g mask="url(#origamiLogoMask)">
        {/* Top-left */}
        <rect x="2"  y="2"  width="49" height="49" rx="20" fill="#CCFF00" />
        {/* Top-right */}
        <rect x="49" y="2"  width="49" height="49" rx="20" fill="#CCFF00" />
        {/* Bottom-left */}
        <rect x="2"  y="49" width="49" height="49" rx="20" fill="#CCFF00" />
        {/* Bottom-right */}
        <rect x="49" y="49" width="49" height="49" rx="20" fill="#CCFF00" />
      </g>
    </svg>
  );
}
