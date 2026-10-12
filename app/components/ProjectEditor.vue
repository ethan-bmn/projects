<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { projectSections } from '#shared/types/projects'
import type { ProjectInput, ProjectSection, ProjectSpecification } from '#shared/types/projects'

const props = defineProps<{ initial?: ProjectInput, pending: boolean, error: string }>()
const emit = defineEmits<{ submit: [input: ProjectInput], cancel: [] }>()
const form = reactive({
  name: props.initial?.name ?? '',
  specification: Object.fromEntries(projectSections.map(section => [section.key, props.initial?.specification[section.key] ?? ''])) as Record<ProjectSection, string>
})
const saved = ref(JSON.stringify(form))
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

function submit() {
  if (props.pending) return
  emit('submit', {
    name: form.name,
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
    class="space-y-6"
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

    <fieldset
      class="space-y-5"
      :disabled="pending"
    >
      <legend class="mb-4 text-lg font-semibold text-highlighted">
        Cahier des charges
      </legend>
      <UFormField
        v-for="section in projectSections"
        :key="section.key"
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
      </UFormField>
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
        label="Enregistrer le projet"
        :loading="pending"
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
