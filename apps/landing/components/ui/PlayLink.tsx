"use client";

import { usePlayUrl } from "@/lib/playUrl";

type PlayLinkProps = Omit<React.ComponentProps<"a">, "href"> & {
  href?: string;
};

/** External play CTA — always includes stored ?ref= when present. */
export function PlayLink({ href: _ignored, children, target = "_blank", rel = "noopener noreferrer", ...props }: PlayLinkProps) {
  const playUrl = usePlayUrl();
  return (
    <a href={playUrl} target={target} rel={rel} {...props}>
      {children}
    </a>
  );
}
