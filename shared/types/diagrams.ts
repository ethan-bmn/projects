export type WbsItem = {
  id: string
  parentId: string | null
  label: string
}

export type ProjectDiagrams = {
  database: string | null
  wbs: WbsItem[]
}

export interface DiagramBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  lines: string[]
}

export interface DiagramDrawing {
  boxes: DiagramBox[]
  edges: { id: string, from: string, to: string }[]
  width: number
  height: number
}
