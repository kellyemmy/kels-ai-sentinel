export function KelsLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kels.Ai logo"
    >
      <g stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="square">
        <line x1="8" y1="6" x2="8" y2="34" />
        <line x1="8" y1="20" x2="22" y2="6" />
        <line x1="8" y1="20" x2="22" y2="34" />
        <line x1="22" y1="6" x2="34" y2="14" />
        <line x1="22" y1="34" x2="34" y2="26" />
      </g>
      <circle cx="22" cy="20" r="3.2" fill="#f59e0b" className="pulse-node" />
    </svg>
  );
}