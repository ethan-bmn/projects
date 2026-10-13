<script setup lang="ts">
import { wbsDrawing, wbsRows } from '#shared/utils/diagrams'
import type { WbsItem } from '#shared/types/diagrams'

const model = defineModel<WbsItem[]>({ required: true })
defineProps<{ disabled: boolean }>()
const rows = computed(() => wbsRows(model.value))
const drawing = computed(() => wbsDrawing(model.value))

function add(parentId: string | null) {
  model.value = [...model.value, { id: crypto.randomUUID(), parentId, label: '' }]
}

function remove(id: string) {
  const removed = new Set([id])
  for (let index = 0; index < 6; index++) {
    for (const item of model.value) if (item.parentId && removed.has(item.parentId)) removed.add(item.id)
  }
  if (removed.size > 1 && !window.confirm('Supprimer cette tâche et toutes ses sous-tâches ?')) return
  model.value = model.value.filter(item => !removed.has(item.id))
}

function move(item: WbsItem, offset: number) {
  const siblings = model.value.filter(candidate => candidate.parentId === item.parentId)
  const target = siblings[siblings.findIndex(candidate => candidate.id === item.id) + offset]
  if (!target) return
  const updated = [...model.value]
  const from = updated.findIndex(candidate => candidate.id === item.id)
  const to = updated.findIndex(candidate => candidate.id === target.id)
  const previous = updated[from]!
  updated[from] = updated[to]!
  updated[to] = previous
  model.value = updated
}
</script>

<template>
  <div class="mt-3 space-y-3">
    <p class="text-sm text-muted">
      Décomposez le projet en phases, tâches et sous-tâches. Le diagramme WBS est inclus dans le PDF.
    </p>
    <div
      v-for="(row, index) in rows"
      :key="row.item.id"
      class="space-y-2 border-l border-default pl-3"
      :style="{ marginLeft: `${row.depth * 12}px` }"
    >
      <label
        :for="`wbs-${row.item.id}`"
        class="block text-sm font-medium text-highlighted"
      >Tâche {{ row.number }}</label>
      <UInput
        :id="`wbs-${row.item.id}`"
        v-model="row.item.label"
        :name="`wbs-${row.item.id}`"
        :maxlength="160"
        :disabled="disabled"
        class="w-full"
        required
      />
      <div class="flex flex-wrap gap-1">
        <UButton
          label="Sous-tâche"
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="disabled || row.depth >= 5 || model.length >= 100"
          @click="add(row.item.id)"
        />
        <UButton
          :aria-label="`Monter la tâche ${row.number}`"
          icon="i-lucide-arrow-up"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="disabled || !rows.slice(0, index).some(candidate => candidate.item.parentId === row.item.parentId)"
          @click="move(row.item, -1)"
        />
        <UButton
          :aria-label="`Descendre la tâche ${row.number}`"
          icon="i-lucide-arrow-down"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="disabled || !rows.slice(index + 1).some(candidate => candidate.item.parentId === row.item.parentId)"
          @click="move(row.item, 1)"
        />
        <UButton
          :aria-label="`Supprimer la tâche ${row.number}`"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="disabled"
          @click="remove(row.item.id)"
        />
      </div>
    </div>
    <UButton
      label="Ajouter une phase"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      :disabled="disabled || model.length >= 100"
      @click="add(null)"
    />
    <DiagramPreview
      v-if="model.length"
      :drawing="drawing"
      label="Décomposition du projet en tâches (WBS)"
      tree
    />
  </div>
</template>
