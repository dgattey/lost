import { cacheLife } from "next/cache";
import Link from "next/link";
import { Camera, Pencil } from "lucide-react";

const primaryCtaClasses =
  "inline-flex w-full h-14 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/80 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-5";

const outlineCtaClasses =
  "inline-flex w-full h-14 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-background px-8 text-base font-medium transition-colors hover:bg-muted hover:text-foreground outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-5";

/** Static home empty-state hero + entry points (deep-link into /score, skip picker step). */
export async function CachedHomeHero() {
  "use cache";
  cacheLife("max");

  return (
    <>
      <div className="text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <h2 className="text-xl font-bold mb-1.5">Score Your Game</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Scan a board photo or enter cards by hand — you go straight into
          that flow.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link href="/score/photo" className={primaryCtaClasses}>
          <Camera className="w-5 h-5" />
          Scan Board Photo
        </Link>
        <Link href="/score/manual" className={outlineCtaClasses}>
          <Pencil className="w-5 h-5" />
          Enter Cards Manually
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
