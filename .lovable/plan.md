

## Plan: Wider Scene Panel + Fixed Height for All Panels

### Changes

1. **`src/components/ui/unified-panel.tsx`**
   - Add optional `fixedHeight` prop to `UnifiedPanelProps`
   - When set, apply a fixed height (e.g. `h-[80vh]`) to the dialog content so tab switching doesn't cause size changes
   - Increase `xs` width from `340px` to `420px` for wider scene panel

2. **`src/components/scenes/SceneSidePanel.tsx`**
   - Pass `fixedHeight` prop to `UnifiedPanel`

3. **`src/components/publishing/PublicationEditDialog.tsx`**
   - Pass `fixedHeight` prop to `UnifiedPanel`

4. **Any other tabbed panels** (VideoDetailModal, VideoEditorDialog, etc.)
   - Pass `fixedHeight` prop where tabs are used

This ensures all modals with tabs maintain consistent dimensions when switching between tabs.

