import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { ArrowRight } from 'lucide-react';
import styles from './Button.module.css';

type Variant = 'primary' | 'ghost' | 'quiet';

const cls = (variant: Variant, small: boolean, className?: string) =>
  [styles.button, styles[variant], small ? styles.small : '', className].filter(Boolean).join(' ');

interface CommonProps {
  variant?: Variant;
  small?: boolean;
  /** Trailing arrow, used on quiet text links ("View scent →"). */
  arrow?: boolean;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  children: ReactNode;
}

const Arrow = () => <ArrowRight className={styles.arrow} size={16} strokeWidth={1.5} aria-hidden="true" />;

export function Button({ variant = 'primary', small = false, arrow = false, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={cls(variant, small, className)} {...rest}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps, CommonProps {}

export function ButtonLink({ variant = 'primary', small = false, arrow = false, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cls(variant, small, typeof className === 'string' ? className : undefined)} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

interface ButtonAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement>, CommonProps {
  /** In-page fragment, e.g. "#collection". Native jump, no router involvement. */
  href: `#${string}`;
}

export function ButtonAnchor({ variant = 'primary', small = false, arrow = false, className, children, ...rest }: ButtonAnchorProps) {
  return (
    <a className={cls(variant, small, className)} {...rest}>
      {children}
      {arrow && <Arrow />}
    </a>
  );
}
