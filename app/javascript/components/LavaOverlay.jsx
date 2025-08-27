import { useMemo } from "react";

const LavaOverlay = ({ progress }) => {
  const blobs = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const r = 80 + Math.random() * 60;
      const cx = -100 + Math.random() * 400; // Start mostly off-left-screen
      const cy = 100 + Math.random() * 400;
      const dur = 15 + Math.random() * 10;
      const delay = Math.random() * 5;
      return { id: i, cx, cy, r, dur, delay };
    });
  }, []);

  // Calculate coverage - starts completely left (0% visible) to full coverage (100% visible)
  const coverage = progress * 100;
  const widthPercent = 100 + coverage * 1.5; // Grows wider as it progresses
  const leftPercent = -50 + (progress * 50); // Starts left (-50%) and moves right

  // Background color that blends to lava color in last 10%
  const bgColor = progress > 0.9 
    ? `rgba(156, 56, 72, ${(progress - 0.9) * 10 * 0.5})` 
    : 'transparent';

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Background that fades to lava color in last 10% */}
      <div className="absolute inset-0" style={{
        backgroundColor: bgColor,
        transition: 'background-color 0.5s ease-out'
      }} />
      
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute top-0 h-full"
        style={{
          width: `${widthPercent}%`,
          left: `${leftPercent}%`,
          transition: 'all 1s linear',
          willChange: 'transform',
          transform: 'translateZ(0)', // kick in GPU acceleration
        }}
      >
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 18 -7"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
          <linearGradient id="lavaGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFAD69" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#9C3848" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <g filter="url(#gooey)">
          {blobs.map((blob) => (
            <circle
              key={blob.id}
              cx={blob.cx}
              cy={blob.cy}
              r={blob.r}
              fill="url(#lavaGradient)"
            >
              <animate
                attributeName="cy"
                values={`${blob.cy};${blob.cy + 70};${blob.cy - 35};${blob.cy}`}
                dur={`${blob.dur}s`}
                repeatCount="indefinite"
                begin={`${blob.delay}s`}
              />
              <animate
                attributeName="cx"
                values={`${blob.cx};${blob.cx + 120};${blob.cx - 60};${blob.cx}`}
                dur={`${blob.dur * 1.5}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values={`${blob.r};${blob.r * 1.1};${blob.r * 0.95};${blob.r}`}
                dur={`${blob.dur * 0.8}s`}
                repeatCount="indefinite"
                begin={`${blob.delay * 0.5}s`}
              />
            </circle>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default LavaOverlay;