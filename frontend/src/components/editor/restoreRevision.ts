/**
 * Restore a stored revision into the live collaborative document.
 *
 * A Yjs update can only add operations. They are commutative, associative and
 * idempotent, so applying one never removes or reverts existing content. A
 * revision snapshot is this document's own history at an earlier point, which
 * every open client already holds, so replaying it against the live document is
 * a guaranteed no-op and cannot roll anything back.
 *
 * A revert therefore has to be expressed as new operations. We rebuild the
 * target ProseMirror document from the snapshot and replace the live content
 * with it in a single transaction. `ySyncPlugin` translates that into the
 * delete and insert operations that carry the revert to every peer over the
 * existing connection, and the change joins the undo stack like any other edit.
 */
import { Fragment, type Node as PMNode, type Schema } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import * as Y from 'yjs';
import { initProseMirrorDoc } from 'y-prosemirror';

/** The Yjs root a Nosdesk collaborative document lives under. */
const ROOT_FRAGMENT = 'prosemirror';

/**
 * Materialise a revision's full Yjs v1 update as a detached ProseMirror
 * document. The scratch doc exists only to be read, so it is always destroyed.
 */
export function revisionToProseMirrorDoc(schema: Schema, updateBytes: Uint8Array): PMNode {
  const scratchDoc = new Y.Doc();
  try {
    Y.applyUpdate(scratchDoc, updateBytes);
    const { doc } = initProseMirrorDoc(scratchDoc.getXmlFragment(ROOT_FRAGMENT), schema);
    return doc;
  } finally {
    scratchDoc.destroy();
  }
}

/**
 * Replace the live document's content with the revision's.
 *
 * Returns false when the document already matches the revision, so callers can
 * tell "restored" from "nothing to do" rather than reporting a change that
 * never happened.
 */
export function restoreRevisionIntoView(view: EditorView, updateBytes: Uint8Array): boolean {
  const { schema } = view.state;
  const target = revisionToProseMirrorDoc(schema, updateBytes);

  // The schema requires at least one block, so an empty revision restores to a
  // single empty paragraph rather than an invalid document.
  const content =
    target.content.size > 0 ? target.content : Fragment.from(schema.nodes.paragraph.create());

  // ProseMirror does not diff, so a replace always counts as a change. Compare
  // the content instead: dispatching a no-op replace would rewrite the whole
  // document as Yjs deletes and inserts, churning every peer for nothing.
  if (view.state.doc.content.eq(content)) return false;

  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, content));
  return true;
}
