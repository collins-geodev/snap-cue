const heights = [10, 19, 14, 31, 42, 24, 36, 52, 30, 58, 46, 29, 48, 31, 19, 34, 44, 25, 17, 28, 16, 9];

export function Wave({ animated = false }: { animated?: boolean }) {
  return <div className={`wave ${animated ? "wave-active" : ""}`} aria-hidden="true">{heights.map((height, index) => <i key={index} style={{ height: `${height}px`, animationDelay: `${index * -0.067}s` }} />)}</div>;
}
