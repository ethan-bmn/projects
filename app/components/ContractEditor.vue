<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { Client } from '#shared/types/clients'
import type { ProjectContract } from '#shared/types/contracts'
import { contractMissingFields, contractSections, createContract, fillContractSection } from '#shared/utils/contracts'

const props = defineProps<{ client: Client, initial?: ProjectContract | null, pending: boolean, error: string }>()
const emit = defineEmits<{ submit: [contract: ProjectContract], cancel: [] }>()
const form = reactive<ProjectContract>(structuredClone(toRaw(props.initial ?? createContract(props.client))))
const saved = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== saved.value)
const uploading = ref(false)
const uploadError = ref('')
const missing = computed(() => contractMissingFields(form).length)
const sections = computed(() => contractSections.filter(section => form.includeDataProcessing || !section.title.startsWith('ANNEXE B')))
function markSaved() {
  saved.value = JSON.stringify(form)
}
defineExpose({ markSaved })
function confirmLeave() {
  return !dirty.value || window.confirm('Quitter sans enregistrer les modifications du contrat ?')
}
onBeforeRouteLeave(confirmLeave)
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
function cancel() {
  if (!confirmLeave()) return
  markSaved()
  emit('cancel')
}
function submit() {
  if (props.pending || uploading.value) return
  emit('submit', structuredClone(toRaw(form)))
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || uploading.value) return
  uploading.value = true
  uploadError.value = ''
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Le devis doit peser au maximum 5 Mo.')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Sélectionnez un fichier PDF.')
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.load(bytes)
    if (!pdf.getPageCount()) throw new Error('Le devis PDF est vide.')
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    form.quote = { name: file.name, data: btoa(binary) }
  } catch (cause) {
    uploadError.value = cause instanceof Error ? cause.message : 'Impossible de lire ce PDF.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <form
    class="space-y-6"
    @submit.prevent="submit"
  >
    <p class="text-sm text-muted">
      Modèle : CONTRACT_TEMPLATE.pdf. Les informations sont conservées dans ce contrat, indépendamment des synchronisations Abby.
      {{ missing }} champ(s) à compléter avant l’export.
    </p>
    <fieldset
      :disabled="pending"
      class="space-y-4"
    >
      <legend class="mb-3 font-semibold text-highlighted">
        Devis à joindre
      </legend>
      <p class="text-sm text-muted">
        Toutes les pages du devis PDF sont ajoutées à la fin du contrat (5 Mo maximum).
      </p>
      <label class="block text-sm font-medium text-highlighted">
        Fichier PDF du devis
        <input
          type="file"
          accept="application/pdf,.pdf"
          :disabled="pending || uploading"
          class="mt-2 block w-full text-sm"
          @change="upload"
        >
      </label>
      <p
        v-if="form.quote"
        class="text-sm text-muted"
      >
        Devis joint : {{ form.quote.name }}
      </p>
      <p
        v-if="uploadError"
        role="alert"
        class="text-sm text-error"
      >
        {{ uploadError }}
      </p>
      <UCheckbox
        v-model="form.includeDataProcessing"
        label="Inclure l’annexe B — traitement des données personnelles"
      />
      <details
        v-for="section in sections"
        :key="section.id"
        :open="section.id === '0' || section.id === '1'"
        class="border-t border-default py-4"
      >
        <summary class="cursor-pointer font-medium text-highlighted">
          {{ section.title }}
        </summary>
        <div class="mt-4 space-y-4">
          <UFormField
            v-for="field in section.fields"
            :key="field.key"
            :label="field.label"
            :name="field.key"
            :description="section.fields.filter(item => item.token === field.token).length > 1 ? field.context : undefined"
          >
            <UTextarea
              v-model="form.fields[field.key]"
              :name="field.key"
              :rows="2"
              :maxlength="20000"
              :disabled="pending"
              class="w-full"
            />
          </UFormField>
          <p class="text-sm leading-6 whitespace-pre-wrap text-muted">
            {{ fillContractSection(section, form) }}
          </p>
        </div>
      </details>
    </fieldset>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <div class="flex flex-wrap gap-3 border-t border-default pt-5">
      <UButton
        type="submit"
        label="Enregistrer le contrat"
        :loading="pending"
        :disabled="uploading"
      />
      <UButton
        label="Annuler"
        color="neutral"
        variant="ghost"
        :disabled="pending || uploading"
        @click="cancel"
      />
    </div>
  </form>
</template>
