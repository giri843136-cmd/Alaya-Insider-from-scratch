/**
 * Per-link disclosure label for affiliate/shopping buttons.
 * Renders "(paid link)" beside or under every affiliate CTA
 * to satisfy FTC Amazon Associates disclosure requirements.
 */
export default function PaidLinkTag({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block text-[10px] text-gray-400 italic ${className}`}>
      (paid link)
    </span>
  );
}
