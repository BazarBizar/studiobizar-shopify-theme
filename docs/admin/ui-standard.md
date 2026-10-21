# Admin UI standard

One set of patterns for the whole admin panel. When two screens do the same job, they use the same
component and behave the same way. Each standard below names the pattern that was already the best
in the panel. When something here changes, change it in the shared component, never per screen.

## Audit: what was inconsistent, and the source of truth chosen

| Area | Found | Standard (source of truth) |
|---|---|---|
| Media selection | `MediaPicker` (grid, search, upload, infinite scroll) on single images; a **list** dialog with no upload for the Project gallery and product "photos in a room" (captioned images); lists of photos added **one per dialog** | `MediaPicker` for every media choice, including captioned images, with single and multiple modes |
| Selected media | Four previews: `MediaField`, `MediaListField`, the builder's `ImageField` / `ImageListField`, and the gallery rows, at 48–96px with different buttons | `MediaSlot` (one) and `MediaRows` (many) in `components/admin/media/media-selection.tsx` |
| Record pickers | Products and collections in a **dialog** in forms (`CataloguePicker`), but a **popover** in the builder and on Collections › Featured; designers and projects in a third, separate dialog | `RecordPickerDialog` + `RecordRows` (`components/admin/record-picker.tsx`) for every record, with the same click-to-select and **Select** / **Add N** as the media picker |
| Detail headers | Actions and status in an ad-hoc row under `DetailHeader` (products, collections, customers, entries) | `DetailHeader` with `status` and `actions` props, on the title line |
| Page Content / Settings | Content had a compact editor bar; Settings had a large `DetailHeader` with the tabs below it | `PageEditorBar`, the Content tab's bar, on both tabs |
| Breadcrumbs | The last crumb said "Edit" or "Page" | The record's own name, set by `DetailHeader` / `PageEditorBar` |
| Query tabs | `SiteWideTabs` and `CollectionTabs` held the same `?tab=` code twice | `QueryTabs` |
| Save | Sticky bar with status + Discard + Save on most forms; page settings had no Discard or status; menus had no Discard | `SaveBar` everywhere, with a browser warning when leaving with unsaved changes |
| Confirmations | Deleting an entry kept its dialog open with a spinner; deleting a page closed at once; leaving page settings used `window.confirm` | `ConfirmDialog` (stays open while working) and `useConfirm()` for the "leave anyway?" question |
| Upload | Two copies of upload + toasts (picker, Media library) | `useFileUpload()` + `UploadButton` |
| Empty states | One-line `<p>`s worded and spaced differently | `EmptyState` |

## Shared components

| Component | File | Use |
|---|---|---|
| `PageHeader` | `components/admin/page-header.tsx` | List screens |
| `DetailHeader` | `components/admin/detail-header.tsx` | Record screens: back, title, `status`, `actions`, `meta` |
| `PageEditorBar`, `PageStatusBadge` | `components/admin/pages-table/page-editor-bar.tsx` | A page's Content and Settings; the page status everywhere |
| `CrumbLabel` | `components/admin/crumbs.tsx` | Names the breadcrumb (rendered by the two headers above) |
| `QueryTabs`, `PageTabs` | `components/admin/query-tabs.tsx`, `pages-table/page-tabs.tsx` | URL tabs |
| `SaveBar`, `useUnsavedChangesWarning` | `components/admin/save-bar.tsx` | Every record form |
| `ConfirmDialog`, `useConfirm`, `LEAVE_UNSAVED` | `components/admin/confirm-dialog.tsx` | Every confirmation |
| `EmptyState`, `ErrorState` | `components/admin/empty-state.tsx`, `error-state.tsx` | Nothing here / something failed |
| `MediaPicker` | `components/admin/media/media-picker.tsx` | Choosing files and captioned photos |
| `MediaSlot`, `MediaRows`, `MediaThumb` | `components/admin/media/media-selection.tsx` | Showing chosen media |
| `useFileUpload`, `UploadButton` | `components/admin/media/upload.tsx` | Every upload |
| `RecordPickerDialog`, `RecordRows` | `components/admin/record-picker.tsx` | Choosing and showing records |
| `CataloguePicker`, `ReferencePicker` | `components/admin/catalogue-picker.tsx`, `reference-picker.tsx` | Products/collections; metaobject references (photos go to the media picker) |

Before writing a new header, picker, dialog, save area or empty message, use one of these. If one
cannot do the job, extend it here so every screen gets the change.

## Navigation

- **Breadcrumbs** live in the header bar of the layout, always: Dashboard › Section › Record. A
  record crumb shows the record's name.
- **Back**: a detail screen has the back link above its title (`DetailHeader`); the page editor has
  the back arrow in its bar (`PageEditorBar`).
- **Tabs**: `ui/tabs` everywhere. Tabs that are part of the URL use `QueryTabs` (`?tab=`) or, for
  Content / Settings, `PageTabs` (separate routes). Tabs inside a panel (the section editor's
  Content / Style) are local state.
- **Sidebar**: one row per screen, grouped; no status text except a count badge.

## Page structure

- **List screen**: `PageHeader` (title, one-sentence description, actions on the right) → toolbar →
  table.
- **Record screen**: `DetailHeader` (back link, title, `status` badges, `actions` on the right,
  optional `meta` line) → `max-w-3xl` form → `SaveBar`.
- **Page editor** (a page's Content and Settings): `PageEditorBar` across the top (back, title,
  address, Content | Settings, status, actions), then the tab's own area.
- Sections inside a screen are `Card`s; a group heading inside a card is
  `text-xs font-medium uppercase tracking-wide text-muted-foreground`.

## Forms

- Label above the control (`Label`, text-sm on record forms, text-xs in the builder's narrow
  panel). Help text is one line under the control in `text-xs text-muted-foreground`. Errors are under
  the control in `text-destructive text-xs` with `role="alert"`.
- No technical names, ids, JSON or code on screen; see `lib/admin/field-copy.ts`.
- Switches for on/off; a select for 4+ choices; segmented buttons for 2–3 short choices.

## Actions

| Kind | Variant | Use |
|---|---|---|
| Primary | `default` | The one main action: Save, Publish, Create, Select |
| Secondary | `outline` | Cancel, Discard, Upload, Choose…, Add… |
| Tertiary | `ghost` | Inline actions in rows, icon buttons (with `aria-label` and `title`) |
| Destructive | `destructive`, or ghost + `text-destructive` in a row | Delete, Remove; always confirmed with `ConfirmDialog` if it cannot be undone |

Labels are verbs: Save, Discard, Upload, Choose image, Add photos, Remove, Delete page.

## Overlays

- **Dialog** for choosing things (media, records) and for forms that need focus.
- **ConfirmDialog** for anything irreversible. It stays open with a spinner until the action
  finishes; Cancel keeps the focus.
- **Popover** only for small inline helpers (a link target next to an input). Never for choosing
  media or records.

## Media

- **Choosing** always opens `MediaPicker`: grid, search, upload, selected state (ring + tick),
  skeleton while loading, empty and error states.
  - Single: click selects, **Select** confirms (double-click selects and confirms at once).
    Uploading confirms at once.
  - Multiple: click toggles, the footer counts, **Add N** confirms. An upload is added to the
    selection.
  - Captioned images (`captioned_image`: the project gallery, "photos in a room") use the same
    picker over the **same library — every Shopify file**, not only the photos that already have a
    caption. On Select / Add each chosen photo becomes its captioned image: the existing one for that
    file, or a new one created for it (caption and credit can be added later under Images). A
    photo that already has a caption shows it on its tile; one already in the field is marked
    "Already added".
- **Showing** what is chosen: `MediaSlot` (preview, Choose / Change, Remove, file name) or
  `MediaRows` (thumbnail, name, extra inputs, move up/down, remove, then "Add photos").

## Feedback

- Loading: `Skeleton` in the shape of what is coming. A button that is working shows a spinner and
  a "…ing" label.
- Empty: `EmptyState` (title + one line of what to do).
- Error: `ErrorState` with Retry.
- Success and failure of an action: a toast ("Saved" + what happened in plain words).
- Unsaved changes: `SaveBar` status line, and the browser asks before leaving the page.
