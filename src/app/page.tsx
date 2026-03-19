import { HomePageClient } from "./home-page-client";
import {
  CachedHomeEmptyAppendix,
  CachedHomeHero,
} from "@/components/cached-marketing-blocks";

export default function HomePage() {
  return (
    <HomePageClient
      emptyHero={<CachedHomeHero />}
      emptyAppendix={<CachedHomeEmptyAppendix />}
    />
  );
}
