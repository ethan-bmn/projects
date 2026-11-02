<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { projectSections } from '#shared/types/projects'
import type { ProjectInput, ProjectSection, ProjectSpecification } from '#shared/types/projects'

const props = defineProps<{ initial?: ProjectInput, pending: boolean, error: string }>()
const emit = defineEmits<{ submit: [input: ProjectInput], cancel: [] }>()
const formElement = useTemplateRef<HTMLFormElement>('formElement')
const activeGroup = ref(0)
const groups: { label: string, keys: ProjectSection[] }[] = [
  { label: 'Cadrage', keys: ['businessContext', 'technicalContext', 'objectives', 'stakes', 'projectScope', 'stakeholders'] },
  { label: 'Besoins et contraintes', keys: ['functionalRequirements', 'nonFunctionalRequirements', 'businessConstraints', 'technicalConstraints', 'acceptanceCriteria'] },
  { label: 'Conception technique', keys: ['softwareArchitecture', 'databaseArchitecture', 'dataManagement', 'toolsAndFrameworks', 'targetDomains'] },
  { label: 'Livraison et planning', keys: ['deliverables', 'operationsAndMaintenance', 'schedule'] }
]
const groupOptions = groups.map((group, index) => ({ label: `${index + 1}. ${group.label}`, value: index }))
const form = reactive({
  name: props.initial?.name ?? '',
  diagrams: {
    database: props.initial?.diagrams?.database ?? null,
    wbs: props.initial?.diagrams?.wbs.map(item => ({ ...item })) ?? []
  },
  specification: Object.fromEntries(projectSections.map(section => [section.key, props.initial?.specification?.[section.key] ?? ''])) as Record<ProjectSection, string>
})
const saved = ref(JSON.stringify(form))
const importingDiagram = ref(false)
const dirty = computed(() => JSON.stringify(form) !== saved.value)

function markSaved() {
  saved.value = JSON.stringify(form)
}
defineExpose({ markSaved })

function confirmLeave() {
  return !dirty.value || window.confirm('Quitter cette page sans enregistrer les modifications ?')
}
onBeforeRouteLeave(confirmLeave)

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

async function submit() {
  if (props.pending || importingDiagram.value) return
  const invalid = formElement.value?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:invalid, textarea:invalid, select:invalid')
  if (invalid) {
    const section = invalid.closest('[data-section]')?.getAttribute('data-section') as ProjectSection | undefined
    const index = groups.findIndex(group => section && group.keys.includes(section))
    if (index >= 0) activeGroup.value = index
    await nextTick()
    invalid.focus()
    invalid.reportValidity()
    return
  }
  emit('submit', {
    name: form.name,
    diagrams: form.diagrams,
    specification: Object.fromEntries(projectSections.map(section => [
      section.key,
      section.optional && !form.specification[section.key].trim() ? null : form.specification[section.key]
    ])) as ProjectSpecification
  })
}

function cancel() {
  if (!confirmLeave()) return
  markSaved()
  emit('cancel')
}
</script>

<template>
  <form
    ref="formElement"
    class="space-y-6"
    novalidate
    @submit.prevent="submit"
  >
    <UFormField
      label="Nom du projet"
      name="name"
      required
    >
      <UInput
        v-model="form.name"
        name="name"
        :maxlength="200"
        :disabled="pending"
        class="w-full"
        required
      />
    </UFormField>

    <div class="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <UFormField
        label="Section du cahier des charges"
        class="lg:hidden"
      >
        <USelect
          v-model="activeGroup"
          :items="groupOptions"
          :disabled="pending || importingDiagram"
          class="w-full"
        />
      </UFormField>
      <nav
        aria-label="Sections du cahier des charges"
        class="hidden gap-2 lg:flex lg:flex-col lg:self-start"
      >
        <button
          v-for="(group, index) in groups"
          :key="group.label"
          type="button"
          :aria-current="activeGroup === index ? 'step' : undefined"
          :disabled="pending || importingDiagram"
          class="shrink-0 rounded-md border px-3 py-3 text-left text-sm transition-colors lg:w-full"
          :class="activeGroup === index ? 'border-accented bg-muted text-highlighted' : 'border-transparent text-muted hover:bg-muted'"
          @click="activeGroup = index"
        >
          <span class="block font-medium">{{ index + 1 }}. {{ group.label }}</span>
          <span class="mt-1 block text-xs text-muted">{{ group.keys.filter(key => form.specification[key].trim()).length }} / {{ group.keys.length }} renseignés</span>
        </button>
      </nav>
      <fieldset
        class="min-w-0 space-y-5"
        :disabled="pending"
      >
        <legend class="mb-4 text-lg font-semibold text-highlighted">
          {{ groups[activeGroup]?.label }}
        </legend>
        <UFormField
          v-for="section in projectSections"
          v-show="groups[activeGroup]?.keys.includes(section.key)"
          :key="section.key"
          :data-section="section.key"
          :label="section.optional ? `${section.label} (optionnel)` : section.label"
          :name="section.key"
          :required="!section.optional"
        >
          <UTextarea
            v-model="form.specification[section.key]"
            :name="section.key"
            :rows="4"
            :maxlength="20000"
            :required="!section.optional"
            :disabled="pending"
            class="w-full"
          />
          <DatabaseDiagramEditor
            v-if="section.key === 'databaseArchitecture'"
            v-model="form.diagrams.database"
            :disabled="pending"
            @busy="importingDiagram = $event"
          />
          <WbsEditor
            v-if="section.key === 'schedule'"
            v-model="form.diagrams.wbs"
            :disabled="pending"
          />
        </UFormField>
      </fieldset>
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
      <UButton
        type="button"
        label="Précédent"
        color="neutral"
        variant="ghost"
        :disabled="activeGroup === 0 || pending || importingDiagram"
        @click="activeGroup--"
      />
      <span class="text-xs text-muted">Section {{ activeGroup + 1 }} sur {{ groups.length }}</span>
      <UButton
        type="button"
        label="Suivant"
        color="neutral"
        variant="outline"
        :disabled="activeGroup === groups.length - 1 || pending || importingDiagram"
        @click="activeGroup++"
      />
    </div>

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
        label="Enregistrer le projet"
        :loading="pending"
        :disabled="importingDiagram"
      />
      <UButton
        label="Annuler"
        color="neutral"
        variant="ghost"
        :disabled="pending"
        @click="cancel"
      />
    </div>
  </form>
</template>
