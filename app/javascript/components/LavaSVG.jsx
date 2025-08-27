import React, { useEffect, useRef } from "react";

const NUM_BLOBS = 10;
const WIDTH = 400;
const HEIGHT = 100;

function random(min, max) {
  return Math.random() * (max - min) + min;
}

const LavaSVG = ({ progress }) => {
  const blobsRef = useRef([]);

  useEffect(() => {
    const interval = setInterval(() => {
      blobsRef.current.forEach((blob) => {
        blob.cx.baseVal.value += random(-1, 1);
        blob.cy.baseVal.value += random(-1, 1);
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const clipWidth = WIDTH * progress;

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>

        <clipPath id="progress-clip">
          <rect x="0" y="0" width={clipWidth} height={HEIGHT} />
        </clipPath>
      </defs>

      <g filter="url(#goo)" clipPath="url(#progress-clip)">
        {[...Array(NUM_BLOBS)].map((_, i) => (
          <circle
            key={i}
            ref={(el) => (blobsRef.current[i] = el)}
            cx={random(0, WIDTH)}
            cy={random(0, HEIGHT)}
            r={random(10, 20)}
            fill="#f87171"
          />
        ))}
      </g>
    </svg>
  );
};

export default LavaSVG;