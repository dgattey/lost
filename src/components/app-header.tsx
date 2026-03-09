"use client";

import Link from "next/link";
import { ArrowLeft, Map } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  backHref?: string;
  onBack?: () => void;
  title?: string;
}

export function AppHeader({
  backHref,
  onBack,
  title = "Lost Cities Scorer",
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center h-14 px-4 max-w-lg mx-auto">
        {(backHref || onBack) && (
          <>
            {backHref ? (
              <Link href={backHref} className="mr-2">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="mr-2"
                onClick={onBack}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
          </>
        )}
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-amber-500" />
          <h1 className="font-bold text-base">{title}</h1>
        </div>
      </div>
    </header>
  );
}
