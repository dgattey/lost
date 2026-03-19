import { cacheLife } from "next/cache";

export async function SiteFooter() {
  "use cache";
  cacheLife("days");

  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-border/50 px-4 py-3 text-center text-xs text-muted-foreground">
      <p>
        <span>© {year}. Created by </span>
        <a
          href="https://gattey.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/90 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Dylan Gattey
        </a>
      </p>
    </footer>
  );
}
