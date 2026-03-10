

## Problem

`editingPublication` stores a **snapshot** of the publication object. After save, `fetchPublications` updates the `publications` array, but `editingPublication` remains the old snapshot. The `useEffect` in the dialog depends on `publication?.id` which doesn't change, so local state never re-syncs with fresh data.

This is a known pattern violation per the project architecture: state should be derived from IDs, not stored as object snapshots.

## Fix

**PublicationsTable.tsx**: Change `editingPublication` from storing a full `Publication` object to storing only the publication **ID** (`string | null`). Derive the live publication object from the `publications` array during render.

```text
Before:  const [editingPublication, setEditingPublication] = useState<Publication | null>(null)
After:   const [editingPublicationId, setEditingPublicationId] = useState<string | null>(null)
         const editingPublication = publications.find(p => p.id === editingPublicationId) || null
```

All `setEditingPublication(pub)` calls become `setEditingPublicationId(pub.id)`, and `setEditingPublication(null)` becomes `setEditingPublicationId(null)`.

This way, when `fetchPublications` completes after save, `editingPublication` automatically points to the fresh object with updated `video_title`, `generated_text`, etc. The dialog renders the latest data immediately.

No changes needed in `PublicationEditDialog.tsx` itself.

