import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

// Plain text put on the clipboard when copying out of the editor. ProseMirror's
// default joins block text and drops everything that isn't text, so a copied
// list loses its markers. Render the structure as markdown-ish text instead.

function leafText(node: PMNode): string {
	if (node.type.name === 'hardBreak') {
		return '\n'
	}
	const fromSpec = node.type.spec.leafText
	if (typeof fromSpec === 'function') {
		return fromSpec(node)
	}
	if (typeof node.attrs?.label === 'string') {
		return node.attrs.label
	}
	return ''
}

function inlineText(node: PMNode): string {
	return node.textBetween(0, node.content.size, '\n', leafText)
}

function prefixLines(text: string, first: string, rest: string): string {
	return text
		.split('\n')
		.map((line, i) => (i === 0 ? first : (line === '' ? '' : rest)) + line)
		.join('\n')
}

function serializeListItem(item: PMNode, marker: string): string {
	const indent = ' '.repeat(marker.length)
	const parts: string[] = []
	item.forEach(child => {
		parts.push(serializeNode(child))
	})
	return prefixLines(parts.join('\n'), marker, indent)
}

function serializeNode(node: PMNode): string {
	switch (node.type.name) {
		case 'bulletList': {
			const items: string[] = []
			node.forEach(item => items.push(serializeListItem(item, '- ')))
			return items.join('\n')
		}
		case 'orderedList': {
			const start = typeof node.attrs.start === 'number' ? node.attrs.start : 1
			const items: string[] = []
			node.forEach((item, _offset, index) => items.push(serializeListItem(item, `${start + index}. `)))
			return items.join('\n')
		}
		case 'taskList': {
			const items: string[] = []
			node.forEach(item => items.push(serializeListItem(item, item.attrs.checked ? '- [x] ' : '- [ ] ')))
			return items.join('\n')
		}
		case 'listItem':
			return serializeListItem(node, '- ')
		case 'taskItem':
			return serializeListItem(node, node.attrs.checked ? '- [x] ' : '- [ ] ')
		case 'blockquote':
			return prefixLines(serializeFragment(node.content), '> ', '> ')
		case 'tableRow': {
			const cells: string[] = []
			node.forEach(cell => cells.push(serializeFragment(cell.content).replace(/\n+/g, ' ')))
			return cells.join('\t')
		}
		case 'table': {
			const rows: string[] = []
			node.forEach(row => rows.push(serializeNode(row)))
			return rows.join('\n')
		}
	}

	if (node.isTextblock) {
		return inlineText(node)
	}
	if (node.isText) {
		return node.text ?? ''
	}
	if (node.isLeaf) {
		return leafText(node)
	}
	return serializeFragment(node.content)
}

function serializeFragment(fragment: Fragment): string {
	const blocks: string[] = []
	let inline = ''
	fragment.forEach(child => {
		if (child.isInline) {
			inline += child.isText ? (child.text ?? '') : leafText(child)
			return
		}
		if (inline !== '') {
			blocks.push(inline)
			inline = ''
		}
		blocks.push(serializeNode(child))
	})
	if (inline !== '') {
		blocks.push(inline)
	}
	return blocks.join('\n')
}

export function serializeSliceAsText(slice: Slice): string {
	return serializeFragment(slice.content)
}
