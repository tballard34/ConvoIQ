interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = '', size = 32 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-labelledby="convoiq-logo-title"
    >
      <title id="convoiq-logo-title">ConvoIQ logo</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Chat bubble */}
        <path d="M48 40h160a24 24 0 0 1 24 24v88a24 24 0 0 1-24 24H100l-36 28v-28H48a24 24 0 0 1-24-24V64a24 24 0 0 1 24-24z" />
        {/* Centered dashboard card */}
        <rect x="68" y="66" width="120" height="84" rx="12" />
        {/* Grid lines */}
        <line x1="108" y1="66" x2="108" y2="150" />
        <line x1="148" y1="66" x2="148" y2="150" />
        <line x1="70" y1="108" x2="148" y2="108" />
      </g>
    </svg>
  );
}

