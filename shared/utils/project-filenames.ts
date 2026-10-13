export function projectSvgFilename(name: string) {
  const slug = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80)
  return `architecture-db-${slug || 'projet'}.svg`
}
