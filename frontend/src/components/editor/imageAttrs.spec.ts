import { describe, it, expect, afterEach } from 'vitest'
import { DOMParser, DOMSerializer } from 'prosemirror-model'
import { configureAssetUrl } from '@nosdesk/core/transport'
import { schema } from './schema'

/**
 * The resize/adjust state rides on image node attrs and must survive the
 * toDOM -> parseDOM round trip: the revision overlay renders via plain
 * toDOM, and copy/paste re-enters through parseDOM.
 */

const serializer = DOMSerializer.fromSchema(schema)
const parser = DOMParser.fromSchema(schema)

function serializeImage(attrs: Record<string, unknown>): HTMLElement {
  const node = schema.nodes.image.create(attrs)
  return serializer.serializeNode(node) as HTMLElement
}

function parseImage(el: HTMLElement): Record<string, unknown> {
  const wrap = document.createElement('p')
  wrap.appendChild(el)
  const doc = parser.parse(wrap)
  let found: Record<string, unknown> | null = null
  doc.descendants((n) => {
    if (n.type === schema.nodes.image) found = n.attrs
  })
  if (!found) throw new Error('no image node parsed')
  return found
}

describe('image resize/adjust attrs', () => {
  it('serializes width as an inline style and align as data-align', () => {
    const el = serializeImage({ src: '/x.png', width: 420, align: 'center' })
    expect(el.tagName).toBe('IMG')
    expect(el.getAttribute('style')).toContain('width: 420px')
    expect(el.getAttribute('data-align')).toBe('center')
  })

  it('omits style and data-align at the defaults', () => {
    const el = serializeImage({ src: '/x.png' })
    expect(el.getAttribute('style')).toBeNull()
    expect(el.getAttribute('data-align')).toBeNull()
  })

  it('round-trips width and align through parseDOM', () => {
    const el = serializeImage({ src: '/x.png', width: 313, align: 'right' })
    const attrs = parseImage(el)
    expect(attrs.width).toBe(313)
    expect(attrs.align).toBe('right')
    expect(attrs.src).toBe('/x.png')
  })

  it('parses a bare legacy img with null width and align', () => {
    const el = document.createElement('img')
    el.setAttribute('src', '/legacy.png')
    const attrs = parseImage(el)
    expect(attrs.width).toBeNull()
    expect(attrs.align).toBeNull()
  })

  it('reads a numeric width attribute and rejects junk alignment', () => {
    const el = document.createElement('img')
    el.setAttribute('src', '/x.png')
    el.setAttribute('width', '240')
    el.setAttribute('data-align', 'sideways')
    const attrs = parseImage(el)
    expect(attrs.width).toBe(240)
    expect(attrs.align).toBeNull()
  })
})

/**
 * On the app the rendered `src` is platform-specific (the webview cannot load a
 * relative `/api/...` URL, so it goes through the asset proxy scheme), while the
 * stored `src` must stay relative: the document is shared, and a paste inside
 * the app re-enters through parseDOM. Writing a `nosdesk-asset://` URL into Yjs
 * would break that image for the web and every other client, permanently.
 */
describe('image src under an asset resolver', () => {
  const PREFIX = 'http://nosdesk-asset.localhost'

  afterEach(() => {
    configureAssetUrl(
      (path) => path,
      (url) => url
    )
  })

  it('renders through the resolver but stores the portable path', () => {
    configureAssetUrl(
      (path) => (path.startsWith('/') ? `${PREFIX}${path}` : path),
      (url) => url.replace(/^(?:nosdesk-asset:\/\/localhost|http:\/\/nosdesk-asset\.localhost)/, '')
    )
    const stored = '/api/files/collab/doc/abc/def_image.png'

    const el = serializeImage({ src: stored })
    expect(el.getAttribute('src')).toBe(`${PREFIX}${stored}`)

    // The round trip a copy/paste performs.
    expect(parseImage(el).src).toBe(stored)
  })

  it('leaves an absolute external src alone in both directions', () => {
    configureAssetUrl(
      (path) => (path.startsWith('/') ? `${PREFIX}${path}` : path),
      (url) => url.replace(/^(?:nosdesk-asset:\/\/localhost|http:\/\/nosdesk-asset\.localhost)/, '')
    )
    const external = 'https://example.com/logo.png'

    const el = serializeImage({ src: external })
    expect(el.getAttribute('src')).toBe(external)
    expect(parseImage(el).src).toBe(external)
  })
})
