import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { authOptions } from "@/lib/auth";

const stars = Array.from({ length: 48 }, (_, index) => {
  const spread = index + 1;

  return {
    left: `${((spread * 17) % 96) + 2}%`,
    top: `${((spread * 23) % 92) + 4}%`,
    size: 1 + ((spread * 7) % 2),
    opacity: 0.45 + ((spread * 13) % 35) / 100,
    duration: 4.5 + ((spread * 19) % 30) / 10,
    delay: -(((spread * 11) % 40) / 10),
  };
});

type PlanetGlowCluster = {
  left: number;
  top: number;
  radiusX: number;
  radiusY: number;
  count: number;
  opacityMin: number;
  opacityMax: number;
};

function createRng(seed: number) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const ambientGlows = [
  {
    left: "6%",
    top: "10%",
    size: "18rem",
    opacity: 0.14,
    duration: "24s",
    delay: "-8s",
  },
  {
    left: "18%",
    top: "62%",
    size: "16rem",
    opacity: 0.1,
    duration: "28s",
    delay: "-14s",
  },
  {
    left: "72%",
    top: "14%",
    size: "22rem",
    opacity: 0.12,
    duration: "32s",
    delay: "-20s",
  },
];

const scatterRng = createRng(91);

const starScatterBursts = Array.from({ length: 11 }, (_, index) => {
  const duration = 10 + scatterRng() * 5.4;
  const travelX = 72 + scatterRng() * 82;
  const travelY = 26 + scatterRng() * 56;

  return {
    id: `scatter-${index}`,
    left: `${6 + scatterRng() * 84}%`,
    top: `${8 + scatterRng() * 62}%`,
    duration,
    delay: -(scatterRng() * duration),
    travelX,
    travelY,
    midX: travelX * 0.64,
    midY: travelY * 0.64,
    rotation: `${10 + scatterRng() * 18}deg`,
    size: `${2 + Math.floor(scatterRng() * 2)}px`,
    tail: `${36 + scatterRng() * 30}px`,
  };
});

const planetGlowClusters: PlanetGlowCluster[] = [
  // North-west
  {
    left: 24,
    top: 18,
    radiusX: 5,
    radiusY: 4,
    count: 24,
    opacityMin: 0.14,
    opacityMax: 0.36,
  },
  {
    left: 34,
    top: 18,
    radiusX: 7,
    radiusY: 4,
    count: 38,
    opacityMin: 0.18,
    opacityMax: 0.44,
  },
  {
    left: 48,
    top: 20,
    radiusX: 8,
    radiusY: 4,
    count: 34,
    opacityMin: 0.16,
    opacityMax: 0.4,
  },
  {
    left: 60,
    top: 22,
    radiusX: 6,
    radiusY: 4,
    count: 28,
    opacityMin: 0.16,
    opacityMax: 0.38,
  },

  // West side
  {
    left: 16,
    top: 26,
    radiusX: 4,
    radiusY: 5,
    count: 26,
    opacityMin: 0.18,
    opacityMax: 0.48,
  },
  {
    left: 22,
    top: 34,
    radiusX: 6,
    radiusY: 8,
    count: 68,
    opacityMin: 0.24,
    opacityMax: 0.62,
  },
  {
    left: 18,
    top: 44,
    radiusX: 5,
    radiusY: 7,
    count: 54,
    opacityMin: 0.22,
    opacityMax: 0.56,
  },
  {
    left: 26,
    top: 48,
    radiusX: 4,
    radiusY: 4,
    count: 24,
    opacityMin: 0.18,
    opacityMax: 0.46,
  },

  // Europe-like center
  {
    left: 32,
    top: 39,
    radiusX: 4,
    radiusY: 6,
    count: 42,
    opacityMin: 0.34,
    opacityMax: 0.72,
  },
  {
    left: 41,
    top: 30,
    radiusX: 7,
    radiusY: 12,
    count: 84,
    opacityMin: 0.28,
    opacityMax: 0.62,
  },
  {
    left: 35,
    top: 52,
    radiusX: 7,
    radiusY: 7,
    count: 72,
    opacityMin: 0.34,
    opacityMax: 0.76,
  },
  {
    left: 43,
    top: 46,
    radiusX: 8,
    radiusY: 7,
    count: 118,
    opacityMin: 0.34,
    opacityMax: 0.82,
  },
  {
    left: 53,
    top: 46,
    radiusX: 10,
    radiusY: 8,
    count: 136,
    opacityMin: 0.34,
    opacityMax: 0.82,
  },
  {
    left: 47,
    top: 58,
    radiusX: 2.8,
    radiusY: 7,
    count: 34,
    opacityMin: 0.3,
    opacityMax: 0.74,
  },
  {
    left: 54,
    top: 58,
    radiusX: 5,
    radiusY: 5,
    count: 44,
    opacityMin: 0.32,
    opacityMax: 0.72,
  },
  {
    left: 63,
    top: 57,
    radiusX: 8,
    radiusY: 4,
    count: 52,
    opacityMin: 0.28,
    opacityMax: 0.66,
  },
  {
    left: 39,
    top: 67,
    radiusX: 13,
    radiusY: 5,
    count: 36,
    opacityMin: 0.18,
    opacityMax: 0.42,
  },

  // High east
  {
    left: 73,
    top: 23,
    radiusX: 4,
    radiusY: 4,
    count: 28,
    opacityMin: 0.2,
    opacityMax: 0.5,
  },
  {
    left: 79,
    top: 29,
    radiusX: 6,
    radiusY: 5,
    count: 62,
    opacityMin: 0.26,
    opacityMax: 0.64,
  },
  {
    left: 86,
    top: 34,
    radiusX: 5,
    radiusY: 4,
    count: 44,
    opacityMin: 0.24,
    opacityMax: 0.58,
  },
  {
    left: 79,
    top: 38,
    radiusX: 4,
    radiusY: 3,
    count: 26,
    opacityMin: 0.2,
    opacityMax: 0.52,
  },

  // South-east
  {
    left: 77,
    top: 48,
    radiusX: 5,
    radiusY: 7,
    count: 54,
    opacityMin: 0.24,
    opacityMax: 0.6,
  },
  {
    left: 82,
    top: 58,
    radiusX: 7,
    radiusY: 9,
    count: 92,
    opacityMin: 0.28,
    opacityMax: 0.7,
  },
  {
    left: 76,
    top: 66,
    radiusX: 6,
    radiusY: 7,
    count: 58,
    opacityMin: 0.24,
    opacityMax: 0.62,
  },
  {
    left: 86,
    top: 72,
    radiusX: 5,
    radiusY: 4,
    count: 26,
    opacityMin: 0.18,
    opacityMax: 0.48,
  },

  // South and edge continents
  {
    left: 18,
    top: 66,
    radiusX: 6,
    radiusY: 8,
    count: 52,
    opacityMin: 0.18,
    opacityMax: 0.5,
  },
  {
    left: 28,
    top: 76,
    radiusX: 8,
    radiusY: 5,
    count: 46,
    opacityMin: 0.16,
    opacityMax: 0.42,
  },
  {
    left: 46,
    top: 78,
    radiusX: 9,
    radiusY: 5,
    count: 54,
    opacityMin: 0.16,
    opacityMax: 0.44,
  },
  {
    left: 62,
    top: 78,
    radiusX: 8,
    radiusY: 5,
    count: 48,
    opacityMin: 0.16,
    opacityMax: 0.42,
  },
  {
    left: 72,
    top: 82,
    radiusX: 7,
    radiusY: 4,
    count: 34,
    opacityMin: 0.14,
    opacityMax: 0.36,
  },
  {
    left: 90,
    top: 24,
    radiusX: 2.6,
    radiusY: 3.2,
    count: 16,
    opacityMin: 0.16,
    opacityMax: 0.4,
  },
  {
    left: 10,
    top: 58,
    radiusX: 3.2,
    radiusY: 4.4,
    count: 18,
    opacityMin: 0.14,
    opacityMax: 0.38,
  },
];

const planetGlowStars = (() => {
  const rng = createRng(27);

  return planetGlowClusters.flatMap((cluster, clusterIndex) =>
    Array.from({ length: cluster.count }, (_, pointIndex) => {
      const angle = rng() * Math.PI * 2;
      const distance = Math.sqrt(rng());
      const x = Math.cos(angle) * cluster.radiusX * distance;
      const y = Math.sin(angle) * cluster.radiusY * distance;
      const left = Math.min(92, Math.max(8, cluster.left + x));
      const top = Math.min(88, Math.max(12, cluster.top + y));

      return {
        id: `${clusterIndex}-${pointIndex}`,
        left: `${left}%`,
        top: `${top}%`,
        size: 1 + Math.floor(rng() * 2),
        opacity:
          cluster.opacityMin +
          (cluster.opacityMax - cluster.opacityMin) * rng(),
        duration: 4.2 + rng() * 2.8,
        delay: -(rng() * 4.2),
      };
    }),
  );
})();

type HomeProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await getServerSession(authOptions);
  const params = (await searchParams) ?? {};
  const authError = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02030b]">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {ambientGlows.map((glow, index) => (
          <span
            key={`${glow.left}-${glow.top}-${index}`}
            className="space-ambient-glow"
            style={{
              left: glow.left,
              top: glow.top,
              width: glow.size,
              height: glow.size,
              opacity: glow.opacity,
              animationDuration: glow.duration,
              animationDelay: glow.delay,
            }}
          />
        ))}
      </div>

      <div aria-hidden="true" className="planet-shell">
        <div className="planet-core">
          <div className="planet-glow-layer">
            {planetGlowStars.map((star) => (
              <span
                key={star.id}
                className="planet-glow-dot"
                style={{
                  left: star.left,
                  top: star.top,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: star.opacity,
                  animationDuration: `${star.duration}s`,
                  animationDelay: `${star.delay}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute left-[12%] top-[18%] h-10 w-10 rounded-full border border-white/16 bg-[radial-gradient(circle_at_32%_32%,rgba(255,255,255,0.26),rgba(193,210,255,0.12)_34%,rgba(255,255,255,0.02)_66%,rgba(255,255,255,0)_100%)] opacity-80 shadow-[0_0_22px_rgba(255,255,255,0.08)]"
      />
      <div
        aria-hidden="true"
        className="absolute right-[18%] top-[26%] h-6 w-6 rounded-full border border-white/14 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.22),rgba(180,210,255,0.08)_36%,rgba(255,255,255,0)_100%)] opacity-70 shadow-[0_0_16px_rgba(255,255,255,0.06)]"
      />
      <div
        aria-hidden="true"
        className="absolute left-[28%] bottom-[20%] h-8 w-8 rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),rgba(188,196,255,0.08)_34%,rgba(255,255,255,0)_100%)] opacity-65 shadow-[0_0_18px_rgba(255,255,255,0.06)]"
      />

      <div aria-hidden="true" className="absolute inset-0">
        {stars.map((star, index) => (
          <span
            key={`${star.left}-${star.top}-${index}`}
            className="simple-star"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <div aria-hidden="true" className="star-scatter-layer">
        {starScatterBursts.map((burst) => (
          <span
            key={burst.id}
            className="star-scatter"
            style={
              {
                left: burst.left,
                top: burst.top,
                "--scatter-duration": `${burst.duration}s`,
                "--scatter-delay": `${burst.delay}s`,
                "--scatter-travel-x": `${burst.travelX}px`,
                "--scatter-travel-y": `${burst.travelY}px`,
                "--scatter-mid-x": `${burst.midX}px`,
                "--scatter-mid-y": `${burst.midY}px`,
                "--scatter-rotation": burst.rotation,
                "--scatter-tail-length": burst.tail,
                "--scatter-size": burst.size,
              } as CSSProperties
            }
          >
            <span className="star-scatter-tail" />
            <span className="star-scatter-head" />
            <span className="star-scatter-fragment star-scatter-fragment-a" />
            <span className="star-scatter-fragment star-scatter-fragment-b" />
            <span className="star-scatter-fragment star-scatter-fragment-c" />
            <span className="star-scatter-fragment star-scatter-fragment-d" />
          </span>
        ))}
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header
          authError={authError}
          isAuthenticated={Boolean(session?.user?.isOwner)}
        />
        <Hero />
        <Footer />
      </div>
    </main>
  );
}
