import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  /** 装飾的な左ドット */
  dot?: boolean;
};

/** 共通ピル型バッジ。色クラスは呼び出し側から渡す */
export const Badge = ({ children, className = "", dot }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-5 ${className}`}
  >
    {dot && (
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full bg-current opacity-70"
      />
    )}
    {children}
  </span>
);
