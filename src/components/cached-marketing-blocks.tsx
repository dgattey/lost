import { cacheLife } from "next/cache";
import Link from "next/link";
import { Camera } from "lucide-react";

const primaryCtaClasses =
  "inline-flex w-full h-14 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/80 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-5";

/** Static home empty-state hero + primary CTA (cacheable shell). */
export async function CachedHomeHero() {
  "use cache";
  cacheLife("max");

  return (
    <>
      <div className="text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <h2 className="text-2xl font-bold mb-2">Score Your Game</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Take a photo of your Lost Cities board or enter cards manually to
          calculate scores instantly.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link href="/score" className={primaryCtaClasses}>
          <Camera className="w-5 h-5" />
          Score First Round
        </Link>
      </div>
    </>
  );
}

/** Photo tip + fan disclaimer on the home empty state. */
export async function CachedHomeEmptyAppendix() {
  "use cache";
  cacheLife("max");

  return (
    <>
      <div className="text-center text-xs text-muted-foreground max-w-xs mx-auto mt-6">
        <p>
          Photo scanning requires an AI API key and a top-down photo of the full
          board.
        </p>
      </div>

      <footer className="text-center text-xs text-muted-foreground/70 max-w-xs mx-auto pt-4 mt-4 border-t border-border/50 space-y-2">
        <p>
          <a
            href="https://store.thamesandkosmos.com/collections/lost-cities"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Buy Lost Cities
          </a>
        </p>
        <p>
          This app is a fan-made scoring tool and is not affiliated with,
          endorsed by, or associated with Kosmos, Thames &amp; Kosmos, or the
          creators of Lost Cities.
        </p>
      </footer>
    </>
  );
}

/** Shared photo-scanning note on the score flow start step. */
export async function CachedScorePhotoScanNote() {
  "use cache";
  cacheLife("max");

  return (
    <div className="text-center text-xs text-muted-foreground max-w-xs">
      <p>
        Photo scanning requires an AI API key and a top-down photo of the full
        board.
      </p>
    </div>
  );
}
