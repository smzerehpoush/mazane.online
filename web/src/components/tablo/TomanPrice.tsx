export function TomanPrice({
  value,
  className,
  unitClassName = "text-[0.58em] font-normal tracking-normal text-muted-foreground",
}: {
  value: string;
  className?: string;
  unitClassName?: string;
}) {
  return (
    <span className={className}>
      <span data-price-value>{value}</span>
      <span data-price-unit className={unitClassName}>
        تومان
      </span>
    </span>
  );
}
