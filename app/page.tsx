import type { Metadata } from "next";
import { HotelLobbyLanding } from "@/components/sections/hotel-lobby-landing";
import { getMessages } from "@/lib/i18n";
import { getLocale, localizeMetadata } from "@/lib/i18n/server";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  const title = "Hotel Lobby AI Video Generator | LobbyDuo";
  const description = "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.";
  // Preserve the indexed homepage copy, including its historical brand, while
  // the shared translator continues to use MigosAI for visible product copy.
  return {
    ...await localizeMetadata({}),
    title: { absolute: messages[title] ?? title },
    description: messages[description] ?? description,
  };
}

export default function HomePage() { return <HotelLobbyLanding/>; }
