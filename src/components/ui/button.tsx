import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type BaseButtonProps = {
  readonly variant?: "primary" | "ghost" | "subtle";
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
  readonly children: ReactNode;
};

type AsButtonProps = BaseButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    readonly href?: undefined;
  };

type AsLinkProps = BaseButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
    readonly href: string;
  };

type ButtonProps = AsButtonProps | AsLinkProps;

function isInternalHref(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

function resolveButtonClasses(
  variant: BaseButtonProps["variant"] = "primary",
  size: BaseButtonProps["size"] = "md",
  className?: string,
) {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`];
  if (className) {
    classes.push(className);
  }
  return classes.join(" ");
}

export default function UIButton(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;
  const classes = resolveButtonClasses(variant, size, className);

  if ("href" in rest && rest.href) {
    const { href, ...anchorProps } = rest as AsLinkProps;

    if (isInternalHref(href)) {
      return (
        <Link href={href} className={classes} {...anchorProps}>
          {children}
        </Link>
      );
    }

    return (
      <a className={classes} href={href} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as AsButtonProps;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
