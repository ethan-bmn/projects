<script setup lang="ts">
import type { DiagramDrawing } from '#shared/types/diagrams'

const props = defineProps<{ drawing: DiagramDrawing, label: string, tree?: boolean }>()
const paths = computed(() => props.drawing.edges.flatMap((edge) => {
  const from = props.drawing.boxes.find(box => box.id === edge.from)
  const to = props.drawing.boxes.find(box => box.id === edge.to)
  if (!from || !to) return []
  const x = props.tree ? from.x + 10 : from.x + from.width
  const startY = props.tree ? from.y + from.height : from.y + from.height / 2
  const endY = to.y + to.height / 2
  const midX = props.tree ? x : (x + to.x) / 2
  return [{ id: edge.id, d: `M ${x} ${startY} H ${midX} V ${endY} H ${to.x}` }]
}))
</script>

<template>
  <div class="max-h-96 overflow-auto rounded-md border border-default bg-default">
    <svg
      :viewBox="`0 0 ${drawing.width} ${drawing.height}`"
      :width="drawing.width"
      :height="drawing.height"
      role="img"
      :aria-label="label"
      class="block text-highlighted"
    >
      <path
        v-for="path in paths"
        :key="path.id"
        :d="path.d"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.5"
      />
      <g
        v-for="box in drawing.boxes"
        :key="box.id"
      >
        <rect
          :x="box.x"
          :y="box.y"
          :width="box.width"
          :height="box.height"
          rx="4"
          fill="var(--ui-bg-elevated)"
          stroke="var(--ui-border-accented)"
        />
        <text
          v-for="(line, index) in box.lines"
          :key="index"
          :x="box.x + 12"
          :y="box.y + 24 + index * 20"
          fill="currentColor"
          font-size="13"
          :font-weight="index === 0 ? 600 : 400"
        >{{ line }}</text>
      </g>
    </svg>
  </div>
</template>
