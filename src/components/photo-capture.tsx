"use client";

import { Camera, ImageIcon, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { resizeImage } from "@/lib/image-utils";

interface PhotoCaptureProps {
  onAnalyze: (base64Image: string) => void;
  isAnalyzing: boolean;
}

export function PhotoCapture({ onAnalyze, isAnalyzing }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const base64 = await resizeImage(file);
        setImageBase64(base64);
        setPreview(`data:image/jpeg;base64,${base64}`);
      } catch {
        console.error("Failed to process image");
      }
    },
    []
  );

  const handleAnalyze = useCallback(() => {
    if (imageBase64) {
      onAnalyze(imageBase64);
    }
  }, [imageBase64, onAnalyze]);

  const handleClear = useCallback(() => {
    setPreview(null);
    setImageBase64(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Take photo with camera"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choose photo from library"
      />

      {!preview ? (
        <div className="flex w-full min-w-0 flex-col gap-4">
          <div className="flex flex-col items-center gap-2 py-12 px-6 border-2 border-dashed border-muted-foreground/25 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
              <Camera className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Take a top-down photo of the full Lost Cities board or choose
              one from your library
            </p>
          </div>

          <Button
            size="lg"
            className="w-full h-14 text-base gap-2"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 text-base gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-5 h-5" />
            Choose from Library
          </Button>
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-4">
          {/* Image preview */}
          <div className="relative rounded-2xl overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Board photo preview"
              className="w-full h-auto"
            />
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 h-14 text-base"
              onClick={handleClear}
              disabled={isAnalyzing}
            >
              Retake
            </Button>
            <Button
              size="lg"
              className="flex-1 h-14 text-base gap-2"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Analyze Board
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
