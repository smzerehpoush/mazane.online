/**
 * ⚠️ Every control is an ordinary `<a href="/tala-18?…">`, and that is deliberate:
 * the table has to sort and filter with JavaScript switched off, because the
 * prices in it are server-rendered and must stay that way. `onViewChange` is
 * a pure enhancement — when the route hands it in, the click is intercepted
 * and the same view is reached without a round trip; when it is absent (tests,
 * no-JS browsers) the link navigates and the server renders the same table.
 */
import type { MouseEvent, ReactNode } from "react";

import {
  comparisonHref,
  toggledFilters,
  type ComparisonModel,
  type ComparisonView,
} from "@/lib/comparison-table";

const CHIP = "transition-smooth rounded-full px-3 py-1.5 text-[11px] font-medium sm:text-xs";
const CHIP_ACTIVE = `${CHIP} bg-foreground text-background`;
const CHIP_IDLE = `${CHIP} bg-surface text-muted-foreground hover:text-foreground`;
const CHIP_OFF = `${CHIP} cursor-not-allowed bg-surface text-muted-foreground/50`;

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function Chip({
  target,
  path,
  active,
  available,
  reasonFa,
  titleFa,
  attrs,
  onViewChange,
  children,
}: {
  target: ComparisonView;
  path: string;
  active: boolean;
  available: boolean;
  reasonFa: string | null;
  titleFa: string;
  attrs: Record<string, string>;
  onViewChange: ((view: ComparisonView) => void) | undefined;
  children: ReactNode;
}) {
  if (!available) {
    return (
      <span {...attrs} aria-disabled="true" title={reasonFa ?? undefined} className={CHIP_OFF}>
        {children}
      </span>
    );
  }
  return (
    <a
      {...attrs}
      href={comparisonHref(target, path)}
      rel="nofollow"
      title={titleFa}
      {...(active ? { "aria-current": "true" as const } : {})}
      className={active ? CHIP_ACTIVE : CHIP_IDLE}
      onClick={
        onViewChange === undefined
          ? undefined
          : (event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              onViewChange(target);
            }
      }
    >
      {children}
    </a>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const DISABLED_HEADING_FA = "چرا بعضی گزینه‌ها خاموش‌اند:";

/**
 * ⚠️ The reason a control is off is printed as ordinary text, not only in
 * `title`/`sr-only`. A tooltip does not exist on a touch screen, and that is
 * where most of the traffic reads this page — a greyed-out chip with no
 * sentence next to it is the site keeping its own gap to itself.
 */
function DisabledReasons({ model }: { model: ComparisonModel }) {
  const byReason = new Map<string, string[]>();
  for (const control of [...model.sorts, ...model.filterControls]) {
    if (control.available || control.reasonFa === null) continue;
    byReason.set(control.reasonFa, [...(byReason.get(control.reasonFa) ?? []), control.label]);
  }
  if (byReason.size === 0) return null;
  return (
    <p data-comparison-disabled className="text-[11px] leading-6 text-muted-foreground">
      {DISABLED_HEADING_FA}{" "}
      {[...byReason].map(([reasonFa, labels], index) => (
        <span key={reasonFa}>
          {index === 0 ? null : "؛ "}
          {labels.map((label) => `«${label}»`).join("، ")} — {reasonFa}
        </span>
      ))}
    </p>
  );
}

export function ComparisonControls({
  model,
  path,
  onViewChange,
}: {
  model: ComparisonModel;
  path: string;
  onViewChange?: ((view: ComparisonView) => void) | undefined;
}) {
  const view: ComparisonView = { sort: model.sort, filters: model.filters };

  return (
    <div
      data-comparison-controls
      className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:px-6"
    >
      <Group label="مرتب‌سازی از کم به زیاد">
        {model.sorts.map((control) => (
          <Chip
            key={control.key}
            path={path}
            target={{ sort: control.key, filters: model.filters }}
            active={control.active}
            available={control.available}
            reasonFa={control.reasonFa}
            titleFa={`مرتب‌سازی بر اساس ${control.label}، از کم به زیاد`}
            attrs={{ "data-sort": control.key }}
            onViewChange={onViewChange}
          >
            {control.label}
          </Chip>
        ))}
      </Group>

      <Group label="فیلتر">
        {model.filterControls.map((control) => (
          <Chip
            key={control.key}
            path={path}
            target={{ sort: model.sort, filters: toggledFilters(model.filters, control.key) }}
            active={control.active}
            available={control.available}
            reasonFa={control.reasonFa}
            titleFa={control.active ? `برداشتن فیلتر ${control.label}` : `فقط ${control.label}`}
            attrs={{ "data-filter": control.key }}
            onViewChange={onViewChange}
          >
            {control.label}
          </Chip>
        ))}
        {model.filters.length === 0 ? null : (
          <a
            data-filter-reset
            href={comparisonHref({ sort: view.sort, filters: [] }, path)}
            rel="nofollow"
            className="transition-smooth text-[11px] text-primary hover:underline"
            onClick={
              onViewChange === undefined
                ? undefined
                : (event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    onViewChange({ sort: view.sort, filters: [] });
                  }
            }
          >
            برداشتن فیلترها
          </a>
        )}
      </Group>

      <DisabledReasons model={model} />
    </div>
  );
}
