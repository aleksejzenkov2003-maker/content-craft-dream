import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface BulkActionsBarProps {
  selectedCount: number;
  totalCount?: number;
  onClearSelection: () => void;
  children: React.ReactNode;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onClearSelection,
  children,
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-primary">
          Выбрано: {selectedCount}
          {totalCount !== undefined && ` из ${totalCount}`}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// Helper component for bulk action button
export interface BulkActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "generate-cover" | "generate-video" | "publish";
}

export function BulkActionButton({
  onClick,
  disabled,
  loading,
  icon,
  children,
  variant = "default",
}: BulkActionButtonProps) {
  return (
    <Button
      size="xs"
      variant={variant}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        icon
      )}
      {children}
    </Button>
  );
}
