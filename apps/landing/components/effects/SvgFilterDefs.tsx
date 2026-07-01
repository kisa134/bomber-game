/** Server-safe SVG filter defs — zero hydration cost (spec §1.1). */
export default function SvgFilterDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="bm-distort" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.022" numOctaves="3" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.5" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="78" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Legacy aliases used by earlier landing pass */}
        <filter id="distort" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.009" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3.4" result="blur" />
          <feDisplacementMap in="SourceGraphic" in2="blur" scale="78" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="distort-lg" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.009" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3.4" result="blur" />
          <feDisplacementMap in="SourceGraphic" in2="blur" scale="140" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="grain-noise" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
          <feBlend in="SourceGraphic" in2="mono" mode="overlay" />
        </filter>
        {/* Coarse stepped displacement — pixel-glass glitch burst */}
        <filter id="bm-pixel-glitch" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045 0.09" numOctaves="1" seed="11" result="pxn" />
          <feDisplacementMap in="SourceGraphic" in2="pxn" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
