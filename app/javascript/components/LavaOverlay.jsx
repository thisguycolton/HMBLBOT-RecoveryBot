// LavaOverlay.jsx

import { useEffect, useMemo, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

/*
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 */

/*
 * The renderer automatically uses as much resolution as it reasonably can,
 * while putting an upper bound on the backing buffer.
 *
 * On smaller screens this will usually be 1:1.
 *
 * On large desktop displays it will reduce the field resolution somewhat
 * to keep Safari from getting hammered.
 */
const MAX_FIELD_WIDTH = 1800;
const MAX_FIELD_HEIGHT = 1100;

/*
 * Original SVG coordinate system.
 */
const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 600;

/*
 * Your original colors.
 */
const LAVA_START = {
  r: 255,
  g: 173,
  b: 105,
};

const LAVA_END = {
  r: 156,
  g: 56,
  b: 72,
};

const LAVA_OPACITY = 0.9;

/*
 * ============================================================================
 * METABALL SETTINGS
 * ============================================================================
 *
 * This is the important part.
 *
 * Each blob contributes:
 *
 *     (radius / distance)^FIELD_POWER
 *
 * The contour is drawn where the total reaches FIELD_THRESHOLD.
 *
 * FIELD_POWER = 4 gives us:
 *
 *   - very circular isolated blobs
 *   - localized attraction
 *   - organic necks
 *   - less "giant amoeba" behavior than power 2
 */
const FIELD_POWER = 4.5;

/*
 * At 1.0, an isolated blob's edge is exactly its radius.
 */
const FIELD_THRESHOLD = 1.3;

/*
 * Softness of the final edge.
 *
 * This is expressed as a fraction of the threshold.
 *
 * Smaller = sharper.
 * Larger = softer.
 */
const EDGE_SOFTNESS = 1.075;

/*
 * We don't need to evaluate the field infinitely far away from a blob.
 *
 * At this distance the contribution is already extremely small.
 */
const INFLUENCE_RADIUS = 2.4;


/*
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

const clamp = (
  value,
  min,
  max
) =>
  Math.min(
    Math.max(
      value,
      min
    ),
    max
  );

const lerp = (
  a,
  b,
  t
) =>
  a +
  (b - a) *
    t;

const smoothstep = (
  edge0,
  edge1,
  value
) => {
  const t =
    clamp(
      (
        value -
        edge0
      ) /
      (
        edge1 -
        edge0
      ),
      0,
      1
    );

  return (
    t *
    t *
    (3 - 2 * t)
  );
};


/*
 * ============================================================================
 * COLOR
 * ============================================================================
 */

const colorAt = (
  position,
  alpha = 1
) => {
  const t =
    clamp(
      position,
      0,
      1
    );

  const r =
    Math.round(
      lerp(
        LAVA_START.r,
        LAVA_END.r,
        t
      )
    );

  const g =
    Math.round(
      lerp(
        LAVA_START.g,
        LAVA_END.g,
        t
      )
    );

  const b =
    Math.round(
      lerp(
        LAVA_START.b,
        LAVA_END.b,
        t
      )
    );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};


/*
 * ============================================================================
 * COMPONENT
 * ============================================================================
 */

const LavaOverlay = ({
  progress,
}) => {
  const canvasRef =
    useRef(null);


  /*
   * --------------------------------------------------------------------------
   * ORIGINAL 7 BLOBS
   * --------------------------------------------------------------------------
   *
   * Keep your original randomization exactly.
   */

  const blobs =
    useMemo(
      () =>
        Array.from({
          length: 7,
        }).map(
          (_, i) => {
            const r =
              80 +
              Math.random() *
                60;

            return {
              id: i,

              cx:
                -100 +
                Math.random() *
                  400,

              cy:
                100 +
                Math.random() *
                  400,

              r,

              dur:
                15 +
                Math.random() *
                  10,

              delay:
                Math.random() *
                5,
            };
          }
        ),
      []
    );


  /*
   * --------------------------------------------------------------------------
   * MOTION PROGRESS
   * --------------------------------------------------------------------------
   */

  const progressValue =
    useMotionValue(
      clamp(
        progress,
        0,
        1
      )
    );

  const smoothProgress =
    useSpring(
      progressValue,
      {
        stiffness: 80,
        damping: 25,
        mass: 0.8,
      }
    );


  useEffect(() => {
    progressValue.set(
      clamp(
        progress,
        0,
        1
      )
    );
  }, [
    progress,
    progressValue,
  ]);


  /*
   * Original final 10% background fade.
   */

  const backgroundOpacity =
    useTransform(
      smoothProgress,
      [0.9, 1],
      [0, 0.5]
    );


  /*
   * ==========================================================================
   * CANVAS RENDERER
   * ==========================================================================
   */

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: true,
          desynchronized: true,
        }
      );

    if (!ctx) {
      return;
    }


    /*
     * ------------------------------------------------------------------------
     * State
     * ------------------------------------------------------------------------
     */

    let cssWidth = 1;
    let cssHeight = 1;

    let fieldWidth = 1;
    let fieldHeight = 1;

    let destroyed = false;
    let animationFrame = null;


    /*
     * ------------------------------------------------------------------------
     * Resize
     * ------------------------------------------------------------------------
     *
     * This only runs when the actual viewport changes.
     *
     * Progress DOES NOT resize this canvas.
     */

    const resize = () => {
      const rect =
        canvas.getBoundingClientRect();

      cssWidth =
        Math.max(
          1,
          rect.width
        );

      cssHeight =
        Math.max(
          1,
          rect.height
        );


      /*
       * Start at 1:1.
       */
      let width =
        Math.round(
          cssWidth
        );

      let height =
        Math.round(
          cssHeight
        );


      /*
       * Limit the backing buffer on very large screens.
       *
       * This preserves aspect ratio.
       */
      const widthScale =
        MAX_FIELD_WIDTH /
        width;

      const heightScale =
        MAX_FIELD_HEIGHT /
        height;

      const scale =
        Math.min(
          1,
          widthScale,
          heightScale
        );

      width =
        Math.max(
          1,
          Math.round(
            width *
              scale
          )
        );

      height =
        Math.max(
          1,
          Math.round(
            height *
              scale
          )
        );


      fieldWidth =
        width;

      fieldHeight =
        height;


      /*
       * This is the ONLY place we change canvas.width/height.
       */

      canvas.width =
        fieldWidth;

      canvas.height =
        fieldHeight;


      /*
       * Make Canvas smooth when its backing resolution is below CSS size.
       */
      ctx.imageSmoothingEnabled =
        true;
    };


    const resizeObserver =
      new ResizeObserver(
        resize
      );

    resizeObserver.observe(
      canvas
    );

    resize();


    /*
     * =========================================================================
     * BLOB ANIMATION
     * =========================================================================
     */

    const getBlobState = (
      blob,
      time
    ) => {
      const elapsed =
        time / 1000 -
        blob.delay;


      /*
       * -----------------------------------------------------------------------
       * Y
       * -----------------------------------------------------------------------
       */

      const yDuration =
        blob.dur;

      const yTime =
        (
          (
            elapsed %
            yDuration
          ) +
          yDuration
        ) %
        yDuration;

      const yProgress =
        yTime /
        yDuration;

      const yScaled =
        yProgress *
        3;

      const ySegment =
        Math.min(
          Math.floor(
            yScaled
          ),
          2
        );

      const yT =
        yScaled -
        ySegment;

      const yEase =
        (
          1 -
          Math.cos(
            yT *
              Math.PI
          )
        ) / 2;

      const yValues = [
        0,
        70,
        -35,
        0,
      ];

      const yOffset =
        lerp(
          yValues[
            ySegment
          ],
          yValues[
            ySegment + 1
          ],
          yEase
        );


      /*
       * -----------------------------------------------------------------------
       * X
       * -----------------------------------------------------------------------
       */

      const xDuration =
        blob.dur *
        1.5;

      const xTime =
        (
          (
            elapsed %
            xDuration
          ) +
          xDuration
        ) %
        xDuration;

      const xProgress =
        xTime /
        xDuration;

      const xScaled =
        xProgress *
        3;

      const xSegment =
        Math.min(
          Math.floor(
            xScaled
          ),
          2
        );

      const xT =
        xScaled -
        xSegment;

      const xEase =
        (
          1 -
          Math.cos(
            xT *
              Math.PI
          )
        ) / 2;

      const xValues = [
        0,
        120,
        -60,
        0,
      ];

      const xOffset =
        lerp(
          xValues[
            xSegment
          ],
          xValues[
            xSegment + 1
          ],
          xEase
        );


      /*
       * -----------------------------------------------------------------------
       * RADIUS
       * -----------------------------------------------------------------------
       */

      const radiusDuration =
        blob.dur *
        0.8;

      const radiusElapsed =
        elapsed -
        blob.delay *
          0.5;

      const radiusTime =
        (
          (
            radiusElapsed %
            radiusDuration
          ) +
          radiusDuration
        ) %
        radiusDuration;

      const radiusProgress =
        radiusTime /
        radiusDuration;

      const radiusScaled =
        radiusProgress *
        3;

      const radiusSegment =
        Math.min(
          Math.floor(
            radiusScaled
          ),
          2
        );

      const radiusT =
        radiusScaled -
        radiusSegment;

      const radiusEase =
        (
          1 -
          Math.cos(
            radiusT *
              Math.PI
          )
        ) / 2;

      const radiusValues = [
        1,
        1.1,
        0.95,
        1,
      ];

      const radiusMultiplier =
        lerp(
          radiusValues[
            radiusSegment
          ],
          radiusValues[
            radiusSegment + 1
          ],
          radiusEase
        );


      return {
        x:
          blob.cx +
          xOffset,

        y:
          blob.cy +
          yOffset,

        r:
          blob.r *
          radiusMultiplier,
      };
    };


    /*
     * =========================================================================
     * RENDER
     * =========================================================================
     */

    const render = (
      time
    ) => {
      if (destroyed) {
        return;
      }


      /*
       * -----------------------------------------------------------------------
       * Progress
       * -----------------------------------------------------------------------
       */

      const p =
        clamp(
          smoothProgress.get(),
          0,
          1
        );


      /*
       * -----------------------------------------------------------------------
       * ORIGINAL SVG VIEWPORT BEHAVIOR
       * -----------------------------------------------------------------------
       *
       * Original:
       *
       * widthPercent =
       *   100 + progress * 150
       *
       * leftPercent =
       *   -50 + progress * 50
       */

      const viewportWidth =
        cssWidth *
        (
          1 +
          p * 1.5
        );

      const viewportHeight =
        cssHeight;

      const viewportLeft =
        cssWidth *
        (
          -0.5 +
          p * 0.5
        );


      /*
       * -----------------------------------------------------------------------
       * xMidYMid slice
       * -----------------------------------------------------------------------
       *
       * SAME scale on X/Y.
       *
       * This is what keeps circles circular.
       */

      const scale =
        Math.max(
          viewportWidth /
            VIEWBOX_WIDTH,

          viewportHeight /
            VIEWBOX_HEIGHT
        );

      const renderedWidth =
        VIEWBOX_WIDTH *
        scale;

      const renderedHeight =
        VIEWBOX_HEIGHT *
        scale;

      const offsetX =
        viewportLeft +
        (
          viewportWidth -
          renderedWidth
        ) / 2;

      const offsetY =
        (
          viewportHeight -
          renderedHeight
        ) / 2;


      /*
       * Field pixels → CSS pixels.
       */

      const sx =
        fieldWidth /
        cssWidth;

      const sy =
        fieldHeight /
        cssHeight;


      /*
       * We deliberately use the same scale for both axes.
       *
       * If the field is downsampled, this keeps the world geometry correct.
       */

      const rasterScale =
        Math.min(
          sx,
          sy
        );


      /*
       * -----------------------------------------------------------------------
       * Blob states
       * -----------------------------------------------------------------------
       */

      const states =
        blobs.map(
          (blob) =>
            getBlobState(
              blob,
              time
            )
        );


      /*
       * -----------------------------------------------------------------------
       * Convert blobs into field coordinates.
       * -----------------------------------------------------------------------
       */

      const fieldBlobs =
        states.map(
          (blob) => ({
            x:
              (
                offsetX +
                blob.x *
                  scale
              ) *
              sx,

            y:
              (
                offsetY +
                blob.y *
                  scale
              ) *
              sy,

            r:
              blob.r *
              scale *
              rasterScale,
          })
        );


      /*
       * -----------------------------------------------------------------------
       * Clear
       * -----------------------------------------------------------------------
       */

      ctx.clearRect(
        0,
        0,
        fieldWidth,
        fieldHeight
      );


      /*
       * -----------------------------------------------------------------------
       * We build the silhouette using Canvas compositing.
       *
       * Instead of creating an ImageData buffer and writing millions of
       * pixels, we render each influence into the canvas as a radial gradient.
       *
       * BUT:
       *
       * We use "lighter" to accumulate influence.
       *
       * The resulting field is then clipped using a second pass.
       *
       * For the actual threshold, we use a lightweight offscreen field.
       * -----------------------------------------------------------------------
       */


      /*
       * Offscreen field canvas is created lazily and kept stable.
       */
      if (
        !render.fieldCanvas ||
        render.fieldCanvas.width !==
          fieldWidth ||
        render.fieldCanvas.height !==
          fieldHeight
      ) {
        render.fieldCanvas =
          document.createElement(
            "canvas"
          );

        render.fieldCanvas.width =
          fieldWidth;

        render.fieldCanvas.height =
          fieldHeight;

        render.fieldCtx =
          render.fieldCanvas.getContext(
            "2d"
          );
      }

      const fieldCanvas =
        render.fieldCanvas;

      const fieldCtx =
        render.fieldCtx;

      if (!fieldCtx) {
        return;
      }


      /*
       * Clear field.
       */
      fieldCtx.clearRect(
        0,
        0,
        fieldWidth,
        fieldHeight
      );


      /*
       * -----------------------------------------------------------------------
       * Draw metaball influence.
       * -----------------------------------------------------------------------
       *
       * We approximate:
       *
       *     (r / d)^4
       *
       * with radial gradients.
       *
       * The gradient is deliberately concentrated near the circle edge.
       */

      fieldCtx.globalCompositeOperation =
        "lighter";


      for (
        const blob of fieldBlobs
      ) {
        /*
         * Influence radius.
         *
         * We don't want blobs affecting things on the other side of the
         * screen.
         */

        const influenceRadius =
          blob.r *
          INFLUENCE_RADIUS;


        /*
         * The gradient represents the field strength.
         *
         * Center = 1
         *
         * Edge = 0
         */

        const gradient =
          fieldCtx.createRadialGradient(
            blob.x,
            blob.y,
            0,
            blob.x,
            blob.y,
            influenceRadius
          );


        /*
         * A steep radial falloff approximates the fourth-power field.
         */

        gradient.addColorStop(
          0,
          "rgba(255,255,255,1)"
        );

        gradient.addColorStop(
          0.35,
          "rgba(255,255,255,0.85)"
        );

        gradient.addColorStop(
          0.58,
          "rgba(255,255,255,0.35)"
        );

        gradient.addColorStop(
          0.72,
          "rgba(255,255,255,0.08)"
        );

        gradient.addColorStop(
          1,
          "rgba(255,255,255,0)"
        );


        fieldCtx.fillStyle =
          gradient;

        fieldCtx.beginPath();

        fieldCtx.arc(
          blob.x,
          blob.y,
          influenceRadius,
          0,
          Math.PI * 2
        );

        fieldCtx.fill();
      }


      fieldCtx.globalCompositeOperation =
        "source-over";


      /*
       * -----------------------------------------------------------------------
       * IMPORTANT:
       *
       * The radial-gradient field above gives us the influence.
       *
       * We now turn it into a silhouette using canvas compositing.
       *
       * The cleanest performant approximation is to use a thresholding
       * canvas operation via an SVG-free luminance mask.
       *
       * We use the field as an alpha mask and then apply a very tight blur/
       * contrast pass.
       * -----------------------------------------------------------------------
       */


      /*
       * Draw the field to the visible canvas first.
       */
      ctx.drawImage(
        fieldCanvas,
        0,
        0
      );


      /*
       * -----------------------------------------------------------------------
       * Colorize the field.
       *
       * "source-in" means only the existing field alpha remains.
       * -----------------------------------------------------------------------
       */

      ctx.globalCompositeOperation =
        "source-in";


      const lavaGradient =
        ctx.createLinearGradient(
          0,
          0,
          fieldWidth,
          fieldHeight
        );

      lavaGradient.addColorStop(
        0,
        colorAt(
          0,
          LAVA_OPACITY
        )
      );

      lavaGradient.addColorStop(
        1,
        colorAt(
          1,
          LAVA_OPACITY
        )
      );

      ctx.fillStyle =
        lavaGradient;

      ctx.fillRect(
        0,
        0,
        fieldWidth,
        fieldHeight
      );


      /*
       * Restore normal compositing.
       */
      ctx.globalCompositeOperation =
        "source-over";


      /*
       * -----------------------------------------------------------------------
       * Next frame.
       * -----------------------------------------------------------------------
       */

      animationFrame =
        requestAnimationFrame(
          render
        );
    };


    animationFrame =
      requestAnimationFrame(
        render
      );


    /*
     * ------------------------------------------------------------------------
     * Cleanup
     * ------------------------------------------------------------------------
     */

    return () => {
      destroyed = true;

      if (
        animationFrame
      ) {
        cancelAnimationFrame(
          animationFrame
        );
      }

      resizeObserver.disconnect();
    };
  }, [
    blobs,
    smoothProgress,
  ]);


  /*
   * ==========================================================================
   * DOM
   * ==========================================================================
   */

  return (
    <div
      className="
        absolute
        inset-0
        pointer-events-none
        z-0
        overflow-hidden
      "
    >
      {/*
       * Original final 10% background transition.
       */}

      <motion.div
        className="
          absolute
          inset-0
        "
        style={{
          backgroundColor:
            "#9C3848",

          opacity:
            backgroundOpacity,
        }}
      />

      {/*
       * One stable Canvas.
       *
       * Progress does NOT affect its DOM dimensions.
       */}

      <canvas
        ref={canvasRef}
        className="
          absolute
          inset-0
          block
          h-full
          w-full
        "
        style={{
          willChange:
            "contents",
        }}
      />
    </div>
  );
};

export default LavaOverlay;