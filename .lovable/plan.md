

## Problem

The content inside the `UnifiedPanel` body (inputs, textareas, tabs) overflows horizontally because the body container lacks `overflow-hidden` and child elements like `Textarea` and `Input` don't have `min-w-0` to prevent flex/grid overflow.

## Plan

### 1. Fix UnifiedPanel body container (unified-panel.tsx)
- Add `overflow-hidden` to the body wrapper `div` inside `ScrollArea` so children are constrained to the panel width.
- Change `<div className="p-4 space-y-4">` to `<div className="p-4 space-y-4 overflow-hidden">`.

### 2. Fix PublicationEditDialog children (PublicationEditDialog.tsx)
- Add `overflow-hidden` to the `Tabs` container.
- Add `overflow-hidden` on each `TabsContent`.
- Add `min-w-0 w-full` to `Textarea` and `Input` elements inside the dialog to prevent them from expanding beyond the container.
- Add `overflow-hidden` or `min-w-0` on `PanelField` text spans to handle long text truncation.

These two changes together ensure all content stays within the panel bounds.

