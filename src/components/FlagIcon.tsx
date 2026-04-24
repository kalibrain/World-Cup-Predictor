interface FlagIconProps {
  countryCode: string;
  teamName: string;
  size?: number;
}

export function FlagIcon({ countryCode, teamName, size = 40 }: FlagIconProps) {
  const w = size;
  const h = Math.round(size * 3 / 4);
  return (
    <img
      className="flag-icon"
      src={`https://flagcdn.com/${w}x${h}/${countryCode}.png`}
      srcSet={`https://flagcdn.com/${w * 2}x${h * 2}/${countryCode}.png 2x, https://flagcdn.com/${w * 3}x${h * 3}/${countryCode}.png 3x`}
      width={w}
      height={h}
      alt={`${teamName} flag`}
      loading="lazy"
    />
  );
}
