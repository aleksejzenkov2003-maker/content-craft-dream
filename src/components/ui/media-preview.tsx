import * as React from "react";
import { useState } from "react";
import { Play, X, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export interface MediaPreviewProps {
  src: string | null | undefined;
  type: "image" | "video";
  alt?: string;
  className?: string;
  thumbnailClassName?: string;
  showPlaceholder?: boolean;
  placeholderSize?: "sm" | "md" | "lg";
}

const placeholderSizes = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

export function MediaPreview({
  src,
  type,
  alt = "Media preview",
  className,
  thumbnailClassName,
  showPlaceholder = true,
  placeholderSize = "md",
}: MediaPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src) {
    if (!showPlaceholder) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded border border-border/50",
          placeholderSizes[placeholderSize],
          className
        )}
      >
        {type === "image" ? (
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Video className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-destructive/10 rounded border border-destructive/30",
          placeholderSizes[placeholderSize],
          className
        )}
      >
        <X className="w-4 h-4 text-destructive" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative group overflow-hidden rounded border border-border/50 bg-muted transition-all hover:border-primary/50 hover:shadow-md cursor-pointer",
          placeholderSizes[placeholderSize],
          className
        )}
      >
        {type === "image" ? (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={cn(
              "w-full h-full object-cover transition-opacity",
              !isLoaded && "opacity-0",
              thumbnailClassName
            )}
          />
        ) : (
          <div className="relative w-full h-full">
            <video
              src={src}
              muted
              className={cn(
                "w-full h-full object-cover",
                thumbnailClassName
              )}
              onLoadedData={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="h-4 w-4" />
            </Button>
            {type === "image" ? (
              <img
                src={src}
                alt={alt}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            ) : (
              <video
                src={src}
                controls
                autoPlay
                className="w-full h-auto max-h-[85vh]"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact inline thumbnail for tables
export interface MediaThumbnailProps {
  src: string | null | undefined;
  type: "image" | "video";
  alt?: string;
  size?: "xs" | "sm" | "md";
}

const thumbnailSizes = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
};

export function MediaThumbnail({
  src,
  type,
  alt = "Thumbnail",
  size = "sm",
}: MediaThumbnailProps) {
  return (
    <MediaPreview
      src={src}
      type={type}
      alt={alt}
      className={thumbnailSizes[size]}
      placeholderSize="sm"
    />
  );
}
