import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
} from "react";
import styles from "@/shared/ui/ui.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    variant === "secondary" ? styles.secondary : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button type="button" className={classes} {...props} />;
}

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.card, className].filter(Boolean).join(" ")} {...props} />;
}

export function Banner({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={[styles.banner, className].filter(Boolean).join(" ")} {...props} />
  );
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={[styles.badge, className].filter(Boolean).join(" ")} {...props} />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={[styles.spinner, className].filter(Boolean).join(" ")}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Alert({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={[styles.alert, className].filter(Boolean).join(" ")} {...props} />
  );
}
