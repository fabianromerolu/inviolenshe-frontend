import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  badge: string;
  title: string;
  description: string;
  icon: LucideIcon;
  details?: string[];
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({
  badge,
  title,
  description,
  icon: Icon,
  details = [],
  children,
  className,
}: PageHeroProps) {
  return (
    <section className={cn("lab-hero p-6 sm:p-8", className)}>
      <div className="lab-grid absolute inset-0 opacity-20" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="lab-pill mb-4">{badge}</div>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-white/12 ring-1 ring-white/20 backdrop-blur">
              <Icon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.25rem]">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/74 sm:text-[0.98rem]">
                {description}
              </p>
            </div>
          </div>
          {details.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {details.map((detail) => (
                <span
                  key={detail}
                  className="inline-flex items-center rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-medium text-white/78"
                >
                  {detail}
                </span>
              ))}
            </div>
          )}
        </div>

        {children ? <div className="relative">{children}</div> : null}
      </div>
    </section>
  );
}
