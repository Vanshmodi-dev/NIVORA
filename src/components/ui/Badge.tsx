import type { ReactNode } from "react";
import { CircleCheck, CircleDashed, CircleX, Clock, TriangleAlert } from "lucide-react";
import type { Tone } from "../../domain/labels";
import styles from "./Badge.module.css";

const TONE_ICON: Record<Tone, ReactNode> = {
  positive: <CircleCheck size={14} aria-hidden="true" />,
  warning: <TriangleAlert size={14} aria-hidden="true" />,
  pending: <Clock size={14} aria-hidden="true" />,
  neutral: <CircleDashed size={14} aria-hidden="true" />,
  error: <CircleX size={14} aria-hidden="true" />,
};

/** Status badge: always icon + text, so meaning never relies on colour alone (§14.6). */
export function Badge({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} data-tone={tone}>
      {icon ?? TONE_ICON[tone]}
      <span>{children}</span>
    </span>
  );
}
