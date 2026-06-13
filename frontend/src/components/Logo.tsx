import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
  /** Use on dark backgrounds (e.g. demo nav). */
  variant?: "default" | "light";
  size?: "sm" | "md" | "lg";
}

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const SIZES = {
  sm: { icon: "h-9 w-9", text: "text-lg" },
  md: { icon: "h-11 w-11 sm:h-12 sm:w-12", text: "text-xl sm:text-2xl" },
  lg: { icon: "h-16 w-16", text: "text-2xl" },
} as const;

export function Logo({
  className,
  showText = true,
  variant = "default",
  size = "md",
}: LogoProps) {
  const { icon, text } = SIZES[size];
  const textClass = variant === "light" ? "text-white" : "text-pink";

  return (
    <div
      className={joinClasses("flex items-center gap-2.5", className)}
      role="img"
      aria-label="FineLens"
    >
      <div className={joinClasses("relative shrink-0", icon)}>
        <Image
          src="/logo-icon.png"
          alt=""
          width={900}
          height={580}
          className="h-full w-full scale-[1.15] object-contain object-left"
          priority
        />
      </div>
      {showText && (
        <span
          className={joinClasses(
            "font-bold leading-none tracking-tight",
            text,
            textClass
          )}
        >
          FineLens
        </span>
      )}
    </div>
  );
}
