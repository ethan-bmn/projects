<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { Client } from '#shared/types/clients'
import type { ProjectContract } from '#shared/types/contracts'
import type { ProviderProfile } from '#shared/types/provider'
import { contractExportIssues, contractSections, filledContractSections, upgradeContract } from '#shared/utils/contracts'
import { activeContractVariables, clientCodeOwnershipClause, contractChoices, contractConfirmations, contractGroups, contractVariableLabel, dataProcessing } from '#shared/utils/contract-configuration'
import { syncContractReference } from '#shared/utils/contract-reference'
import { contractFieldHelp } from '#shared/utils/contract-field-help'

const props = defineProps<{ client: Client, provider?: ProviderProfile, initial?: ProjectContract | null, pending: boolean, error: string }>()
const emit = defineEmits<{ submit: [contract: ProjectContract], cancel: [] }>()
const form = reactive<ProjectContract>(upgradeContract(props.initial ? toRaw(props.initial) : null, props.client, props.provider))
const configuration = form.configuration!
const saved = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== saved.value)
const uploading = ref(false)
const readingQuote = ref(false)
const uploadError = ref('')
const quoteNotice = ref('')
const issues = computed(() => contractExportIssues(form))
const preview = computed(() => filledContractSections(form))
const groups = computed(() => contractGroups.map((label, index) => ({
  id: index, label,
  choices: contractChoices.filter(field => !field.hidden && field.group === index && (!field.when || field.when(configuration))),
  variables: activeContractVariables(configuration).filter(field => field.group === index)
})).filter(group => group.choices.length || group.variables.length || group.id === 2 || group.id === 8))
const confirmations = computed(() => contractConfirmations.filter(field => !field.when || field.when(configuration)))
const legacyValues = computed(() => Object.entries(form.fields).filter(([key, value]) => /^\d+\.\d+$/.test(key) && value.trim()))
const legacyLabels = Object.fromEntries(contractSections.flatMap(section => section.fields.map(field => [field.key, `${section.title} — ${field.label}`])))

watch(() => form.fields['devis.reference'], (_, previous) => syncContractReference(form.fields, previous), { flush: 'sync' })

watch([() => JSON.stringify(form.fields), () => form.quote, () => JSON.stringify(configuration.choices), () => JSON.stringify(configuration.selections)], () => {
  for (const field of contractConfirmations) configuration.confirmations[field.key] = false
  form.includeDataProcessing = dataProcessing(configuration)
})
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
  if (props.pending || uploading.value || readingQuote.value) return
  emit('submit', structuredClone({ ...toRaw(form), includeDataProcessing: dataProcessing(configuration) }))
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || uploading.value || readingQuote.value) return
  uploading.value = true
  uploadError.value = ''
  quoteNotice.value = ''
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
    await readQuoteMetadata(bytes, true)
  } catch (cause) {
    uploadError.value = cause instanceof Error ? cause.message : 'Impossible de lire ce PDF.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function readQuoteMetadata(bytes?: Uint8Array, replacing = false) {
  if (!form.quote || readingQuote.value || props.pending) return
  readingQuote.value = true
  quoteNotice.value = ''
  if (replacing) {
    form.fields['devis.reference'] = ''
    form.fields['devis.date'] = ''
  }
  try {
    const { extractQuoteMetadata } = await import('~/lib/quote-reference')
    const content = bytes ?? Uint8Array.from(atob(form.quote.data), character => character.charCodeAt(0))
    const { reference, issueDate } = await extractQuoteMetadata(content)
    if (reference) form.fields['devis.reference'] = reference
    if (issueDate) form.fields['devis.date'] = issueDate
    quoteNotice.value = [
      reference ? `Référence : ${reference}.` : 'Référence non détectée.',
      issueDate ? `Date d’émission : ${issueDate}.` : 'Date d’émission non détectée.',
      'Vérifiez ou complétez ces informations dans l’identité et le cadre juridique.'
    ].join(' ')
  } catch {
    quoteNotice.value = 'Devis joint. La référence et la date d’émission n’ont pas pu être extraites ; renseignez-les dans le formulaire.'
  } finally {
    readingQuote.value = false
  }
}
</script>

<template>
  <form
    class="space-y-6"
    @submit.prevent="submit"
  >
    <p class="text-sm text-muted">
      Sélectionnez les prestations commandées, puis complétez leurs conditions. Les informations sont conservées avec ce contrat.
    </p>
    <p
      v-if="initial?.version === 1"
      class="text-sm text-warning"
    >
      Le modèle a évolué. Vos valeurs ont été reprises ; vérifiez les choix et les conditions avant d’enregistrer.
    </p>
    <section
      v-if="provider"
      class="border-y border-default py-4"
    >
      <h2 class="text-base font-semibold text-highlighted">
        Prestataire
      </h2>
      <dl class="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-muted">
            Nom
          </dt>
          <dd class="text-highlighted">
            {{ provider.name }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            SIREN
          </dt>
          <dd class="text-highlighted">
            {{ provider.siren }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Adresse
          </dt>
          <dd class="whitespace-pre-wrap text-highlighted">
            {{ provider.address }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Contact
          </dt>
          <dd class="text-highlighted">
            {{ provider.email }} · {{ provider.phone }}
          </dd>
        </div>
      </dl>
      <p class="mt-3 text-xs text-muted">
        Ces informations sont communes à tous les contrats.
        <NuxtLink
          to="/settings#provider"
          class="underline underline-offset-2"
        >
          Modifier dans les paramètres
        </NuxtLink>
      </p>
    </section>
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
      <div class="flex items-center justify-between gap-2">
        <label
          for="contract-quote"
          class="text-sm font-medium text-highlighted"
        >Fichier PDF du devis</label>
        <FieldHelp
          label="Fichier PDF du devis"
          :help="contractFieldHelp.quote!"
        />
      </div>
      <input
        id="contract-quote"
        type="file"
        accept="application/pdf,.pdf"
        :disabled="pending || uploading || readingQuote"
        class="mt-2 block w-full text-sm"
        @change="upload"
      >
      <p
        v-if="form.quote"
        class="text-sm text-muted"
      >
        Devis joint : {{ form.quote.name }}
      </p>
      <UButton
        v-if="form.quote"
        label="Lire la référence et la date du PDF"
        color="neutral"
        variant="outline"
        :loading="readingQuote"
        :disabled="pending || uploading"
        @click="readQuoteMetadata()"
      />
      <p
        v-if="quoteNotice"
        role="status"
        class="text-sm text-muted"
      >
        {{ quoteNotice }}
      </p>
      <p
        v-if="uploadError"
        role="alert"
        class="text-sm text-error"
      >
        {{ uploadError }}
      </p>
    </fieldset>

    <fieldset
      v-for="group in groups"
      :key="group.id"
      :disabled="pending || readingQuote || uploading"
      class="space-y-5 border-t border-default pt-5"
    >
      <legend class="pt-4 text-lg font-semibold text-highlighted">
        {{ group.label }}
      </legend>
      <p
        v-if="group.id === 2"
        class="text-sm leading-6 text-muted"
      >
        {{ clientCodeOwnershipClause }}
      </p>
      <UFormField
        v-for="field in group.choices"
        :key="field.key"
        :label="field.label"
        :name="field.key"
      >
        <template #hint>
          <FieldHelp
            :label="field.label"
            :help="contractFieldHelp[field.key]!"
          />
        </template>
        <UCheckboxGroup
          v-if="field.multiple"
          v-model="configuration.selections[field.key]"
          :items="field.options"
          :disabled="pending || readingQuote || uploading"
          :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
        />
        <USelect
          v-else
          v-model="configuration.choices[field.key]"
          :items="field.options"
          placeholder="Choisir une option"
          :disabled="pending || readingQuote || uploading"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-for="field in group.variables"
        :key="field.key"
        :label="contractVariableLabel(configuration, field)"
        :name="field.key"
        :required="!field.optional"
        :description="field.key === 'contrat.reference' ? 'Générée à partir de la référence du devis. Vous pouvez la personnaliser.' : undefined"
      >
        <template #hint>
          <FieldHelp
            :label="contractVariableLabel(configuration, field)"
            :help="contractFieldHelp[field.key]!"
          />
        </template>
        <UTextarea
          v-if="field.type === 'textarea'"
          :model-value="form.fields[field.key]"
          :name="field.key"
          :rows="3"
          :maxlength="20000"
          :disabled="pending || readingQuote || uploading"
          class="w-full"
          @update:model-value="form.fields[field.key] = String($event ?? '')"
        />
        <UInput
          v-else
          :model-value="form.fields[field.key]"
          :name="field.key"
          :type="field.type"
          :min="field.type === 'number' ? 0 : undefined"
          :step="field.type === 'number' ? 'any' : undefined"
          :maxlength="20000"
          :disabled="pending || readingQuote || uploading"
          class="w-full"
          @update:model-value="form.fields[field.key] = String($event ?? '')"
        />
      </UFormField>
      <template v-if="group.id === 8">
        <div
          v-for="confirmation in confirmations"
          :key="confirmation.key"
          class="flex items-start justify-between gap-2"
        >
          <UCheckbox
            v-model="configuration.confirmations[confirmation.key]"
            :label="confirmation.label"
            :disabled="pending || readingQuote || uploading"
          />
          <FieldHelp
            :label="confirmation.label"
            :help="contractFieldHelp[`confirmation.${confirmation.key}`]!"
          />
        </div>
        <p class="text-sm text-muted">
          Les vérifications sont à refaire après toute modification du contrat.
        </p>
      </template>
    </fieldset>

    <details
      v-if="issues.length"
      class="border-t border-default pt-4"
    >
      <summary class="cursor-pointer text-sm font-medium text-highlighted">
        {{ issues.length }} point(s) à compléter avant l’export
      </summary>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        <li
          v-for="issue in issues"
          :key="issue"
        >
          {{ issue }}
        </li>
      </ul>
    </details>
    <p
      v-else
      role="status"
      class="text-sm text-success"
    >
      Le contrat est prêt à être enregistré et exporté.
    </p>
    <details class="border-t border-default pt-4">
      <summary class="cursor-pointer font-medium text-highlighted">
        Aperçu des clauses retenues
      </summary>
      <section
        v-for="(section, index) in preview"
        :key="index"
        class="mt-4 space-y-2"
      >
        <h3 class="font-medium text-highlighted">
          {{ section.title }}
        </h3>
        <p class="text-sm leading-6 whitespace-pre-wrap text-muted">
          {{ section.body }}
        </p>
      </section>
    </details>
    <details
      v-if="legacyValues.length"
      class="border-t border-default pt-4"
    >
      <summary class="cursor-pointer text-sm font-medium text-highlighted">
        Valeurs conservées de l’ancien formulaire
      </summary>
      <dl class="mt-3 space-y-3 text-sm">
        <div
          v-for="[key, value] in legacyValues"
          :key="key"
        >
          <dt class="font-medium text-highlighted">
            {{ legacyLabels[key] }}
          </dt>
          <dd class="mt-1 whitespace-pre-wrap text-muted">
            {{ value }}
          </dd>
        </div>
      </dl>
    </details>
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
        :disabled="uploading || readingQuote"
      />
      <UButton
        label="Annuler"
        color="neutral"
        variant="ghost"
        :disabled="pending || uploading || readingQuote"
        @click="cancel"
      />
    </div>
  </form>
</template>
