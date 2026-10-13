<script setup lang="ts">
import { databaseDrawing, parseChartDb } from '#shared/utils/diagrams'

const model = defineModel<string | null>({ required: true })
defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const error = ref('')
const importing = ref(false)
const showEditor = ref(false)
const chartdbUrl = useRuntimeConfig().public.chartdbUrl
const drawing = computed(() => model.value ? databaseDrawing(model.value) : null)

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  emit('busy', true)
  error.value = ''
  try {
    if (file.size > 500000) throw new Error('Le fichier ChartDB est limité à 500 Ko.')
    const source = await file.text()
    parseChartDb(source)
    model.value = source
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Impossible d’importer ce fichier.'
  } finally {
    importing.value = false
    emit('busy', false)
    input.value = ''
  }
}

function downloadSource() {
  if (!model.value) return
  const url = URL.createObjectURL(new Blob([model.value], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'architecture-chartdb.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="mt-3 space-y-3">
    <p class="text-sm text-muted">
      Créez votre schéma dans l’éditeur ChartDB local, puis importez son export JSON pour l’enregistrer dans le projet et le PDF.
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        :to="chartdbUrl"
        target="_blank"
        rel="noopener noreferrer"
        label="Ouvrir ChartDB"
        icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
      />
      <UButton
        :label="showEditor ? 'Masquer l’éditeur ChartDB' : 'Afficher l’éditeur ChartDB'"
        color="neutral"
        variant="outline"
        :disabled="disabled"
        @click="showEditor = !showEditor"
      />
      <label class="text-sm text-highlighted">
        Importer un fichier JSON
        <input
          type="file"
          name="chartdbFile"
          accept=".json,application/json"
          :disabled="disabled || importing"
          class="mt-1 block max-w-full text-sm"
          @change="importFile"
        >
      </label>
      <UButton
        v-if="model"
        label="Télécharger le JSON"
        color="neutral"
        variant="ghost"
        :disabled="disabled"
        @click="downloadSource"
      />
      <UButton
        v-if="model"
        label="Retirer le diagramme"
        color="neutral"
        variant="ghost"
        :disabled="disabled || importing"
        @click="model = null; error = ''"
      />
    </div>
    <iframe
      v-if="showEditor"
      :src="chartdbUrl"
      title="Éditeur ChartDB local"
      sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-forms"
      referrerpolicy="no-referrer"
      class="h-[32rem] w-full rounded-md border border-default"
    />
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <DiagramPreview
      v-if="drawing"
      :drawing="drawing"
      label="Architecture de la base de données"
    />
  </div>
</template>
