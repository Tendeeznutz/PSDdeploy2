import { motion } from "framer-motion";

function FloatingPaths({ position }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <svg
        style={{ width: "100%", height: "100%", transform: `scaleX(${position > 0 ? 1 : -1})` }}
        viewBox="0 0 696 316"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="#0f172a"
            strokeWidth={path.width}
            strokeOpacity={0.06 + path.id * 0.018}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.7, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 18 + (path.id % 10),
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export function BackgroundPaths({ children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "#f8f7f4" }}>
      {/* Paths layer – stretched to fill entire section */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>
      {/* Content sits above paths */}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
