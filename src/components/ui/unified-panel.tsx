import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const widthClasses = {
  xs: 'max-w-sm w-[420px]',
  sm: 'max-w-md w-[480px]',
  md: 'max-w-2xl w-[640px]',
  lg: 'max-w-4xl w-[900px]',
  xl: 'max-w-5xl w-[90vw]',
};

interface UnifiedPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onPrev?: () => void;
  onNext?: () => void;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  preventOutsideClose?: boolean;
  fixedHeight?: boolean;
}

export function UnifiedPanel({
  open,
  onOpenChange,
  title,
  width = 'md',
  onPrev,
  onNext,
  footer,
  headerActions,
  children,
  preventOutsideClose,
}: UnifiedPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[95vh] !max-w-none !grid-rows-none !grid-cols-none p-0 !flex !flex-col gap-0 overflow-hidden [&>button:last-child]:hidden',
          widthClasses[width]
        )}
        onPointerDownOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
          <div className="flex items-center gap-1">
            {(onPrev || onNext) && (
              <>
                <button
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  onClick={onPrev}
                  disabled={!onPrev}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  onClick={onNext}
                  disabled={!onNext}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <DialogTitle className="font-medium text-sm flex-1 text-center truncate px-2">
            {title}
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            {headerActions}
            <button
              className="p-1 hover:bg-muted rounded"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — native overflow scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4 max-w-full [&_textarea]:max-w-full [&_input]:max-w-full">{children}</div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t shrink-0">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* Standardized field row */
export function PanelField({
  label,
  children,
  labelWidth = '140px',
}: {
  label: string;
  children: React.ReactNode;
  labelWidth?: string;
}) {
  return (
    <div className={`grid gap-2 items-center`} style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/* Section header */
export function PanelSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          {icon}
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}
