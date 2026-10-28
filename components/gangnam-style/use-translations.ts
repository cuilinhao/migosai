'use client';
import { useMemo } from 'react';
import { useLocale, useTranslations } from '@/components/i18n/locale-provider';
import { translateGenerationMessage } from '@/components/generator/use-generation';
import { gangnamUiMessages, getGangnamTranslator } from '@/lib/i18n/gangnam-style';
import type { Locale } from '@/lib/i18n/routing';
import type { Translator, Values } from '@/lib/i18n/translator';

export function translateGangnamMessage(t: Translator, source: string, values?: Values): string {
  const dimensions = source.match(/^Your prepared photo is (\d+) × (\d+) pixels\. Choose a photo with both sides between 301 and 5999 pixels and a width-to-height ratio greater than 0\.4 and less than 2\.5\.$/);
  if (dimensions) return t('Your prepared photo is {width} × {height} pixels. Choose a photo with both sides between 301 and 5999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5.', { width: dimensions[1], height: dimensions[2] });
  return translateGenerationMessage(t, source, values);
}

export function useGangnamTranslations(): Translator {
  const locale = useLocale();
  const shared = useTranslations();
  return useMemo(() => createGangnamMessageTranslator(locale, shared), [locale, shared]);
}

export function createGangnamMessageTranslator(locale: Locale, shared: Translator): Translator {
  const local = getGangnamTranslator(locale);
  const translate: Translator = (source, values) => Object.hasOwn(gangnamUiMessages[locale], source.trim())
    ? local(source, values) : shared(source, values);
  return (source, values) => translateGangnamMessage(translate, source, values);
}
