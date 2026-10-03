"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "./locale-provider";
import { localizeHref } from "@/lib/i18n/routing";
export default function LocalizedLink({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const localized = typeof href === "string" ? localizeHref(href, locale) : href.pathname ? { ...href, pathname: localizeHref(href.pathname, locale) } : href;
  return <NextLink href={localized} {...props}/>;
}
