/**
 * Why restoring a revision has to be a transaction on the live document.
 *
 * The previous implementation rebuilt a document from the revision snapshot on
 * the server and broadcast its full state. That could never work: a Yjs update
 * is a set of operations that is commutative, associative and idempotent, and a
 * revision snapshot holds this document's own earlier history, so every client
 * already has every operation in it. The first test pins that fact, because it
 * is the reason the endpoint reported success while nothing changed on screen.
 *
 * The rest assert the replacement behaviour: the revert reaches the shared Yjs
 * state (so peers converge) and survives the edits made after the revision.
 */
import { describe, expect, it } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import * as Y from 'yjs'
import { initProseMirrorDoc, ySyncPlugin } from 'y-prosemirror'

import { schema } from './schema'
import { restoreRevisionIntoView } from './restoreRevision'

/** A live editor: Y.Doc + bound EditorView, as the app builds it. */
function makeLiveEditor() {
  const ydoc = new Y.Doc({ gc: false })
  const fragment = ydoc.getXmlFragment('prosemirror')
  const mount = document.createElement('div')
  document.body.appendChild(mount)

  const { doc, mapping } = initProseMirrorDoc(fragment, schema)
  const view = new EditorView(mount, {
    state: EditorState.create({ doc, schema, plugins: [ySyncPlugin(fragment, { mapping })] }),
  })
  return { ydoc, view, mount }
}

function appendParagraph(view: EditorView, text: string) {
  const { state } = view
  const node = state.schema.nodes.paragraph.create(null, state.schema.text(text))
  view.dispatch(state.tr.insert(state.doc.content.size, node))
}

const textOf = (view: EditorView) => view.state.doc.textBetween(0, view.state.doc.content.size, ' ')

/** The bytes a revision stores: a full v1 update of the document at that time. */
const snapshot = (ydoc: Y.Doc) => Y.encodeStateAsUpdate(ydoc)

describe('restoreRevisionIntoView', () => {
  it('cannot be done by replaying the snapshot, which is what the server used to broadcast', () => {
    const { ydoc, view } = makeLiveEditor()
    appendParagraph(view, 'first')
    const revision = snapshot(ydoc)
    appendParagraph(view, 'second')

    // Exactly what the old restore sent to every client.
    Y.applyUpdate(ydoc, revision)

    expect(textOf(view)).toContain('second')
  })

  it('reverts the live document to the revision', () => {
    const { ydoc, view } = makeLiveEditor()
    appendParagraph(view, 'first')
    const revision = snapshot(ydoc)
    appendParagraph(view, 'second')

    expect(restoreRevisionIntoView(view, revision)).toBe(true)

    expect(textOf(view)).toContain('first')
    expect(textOf(view)).not.toContain('second')
    void ydoc
  })

  it('writes the revert into the shared Yjs state, so peers converge', () => {
    const { ydoc, view } = makeLiveEditor()
    appendParagraph(view, 'first')
    const revision = snapshot(ydoc)
    appendParagraph(view, 'second')

    const peer = new Y.Doc({ gc: false })
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(ydoc))
    expect(peer.getXmlFragment('prosemirror').toString()).toContain('second')

    restoreRevisionIntoView(view, revision)
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(ydoc))

    const peerText = peer.getXmlFragment('prosemirror').toString()
    expect(peerText).toContain('first')
    expect(peerText).not.toContain('second')
  })

  it('reports no change when the document already matches the revision', () => {
    const { ydoc, view } = makeLiveEditor()
    appendParagraph(view, 'first')

    expect(restoreRevisionIntoView(view, snapshot(ydoc))).toBe(false)
  })
})
