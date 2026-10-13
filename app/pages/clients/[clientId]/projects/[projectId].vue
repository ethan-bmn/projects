<script setup lang="ts">
import { projectSections } from '#shared/types/projects'
import type { Project, ProjectDetail, ProjectInput } from '#shared/types/projects'
import { databaseDrawing, wbsDrawing } from '#shared/utils/diagrams'

const route = useRoute()
const clientId = String(route.params.clientId)
const projectId = String(route.params.projectId)
const { data, error } = await useFetch<ProjectDetail>(`/api/clients/${clientId}/projects/${projectId}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Projet introuvable.' })
useSeoMeta({ title: () => `${data.value?.project.name} | Abby Projects` })

const editing = ref(false)
const pending = ref(false)
const saveError = ref('')
const exporting = ref(false)
const exportError = ref('')
const config = useRuntimeConfig()
const editor = useTemplateRef<{ markSaved: () => void }>('editor')
const dbDrawing = computed(() => data.value?.project.diagrams?.database ? databaseDrawing(data.value.project.diagrams.database) : null)
const planningDrawing = computed(() => data.value?.project.diagrams?.wbs.length ? wbsDrawing(data.value.project.diagrams.wbs) : null)

async function exportPdf() {
  if (exporting.value || !data.value) return
  exporting.value = true
  exportError.value = ''
  try {
    const { downloadProjectPdf } = await import('~/lib/project-pdf')
    await downloadProjectPdf(data.value, config.app.baseURL)
  } catch {
    exportError.value = 'Impossible de générer le PDF. Réessayez.'
  } finally {
    exporting.value = false
  }
}

async function save(input: ProjectInput) {
  if (pending.value) return
  pending.value = true
  saveError.value = ''
  try {
    const project = await $fetch<Project>(`/api/clients/${clientId}/projects/${projectId}`, { method: 'PUT', body: input })
    editor.value?.markSaved()
    data.value!.project = project
    editing.value = false
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible d’enregistrer le projet. Réessayez.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UContainer
    v-if="data"
    class="max-w-3xl py-8"
  >
    <NuxtLink
      :to="`/clients/${clientId}`"
      class="text-sm text-muted underline-offset-4 hover:underline"
    >{{ data.client.name }} · Retour aux projets</NuxtLink>
    <div class="mt-5 flex flex-wrap items-start justify-between gap-4">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ editing ? 'Modifier le projet' : data.project.name }}
      </h1>
      <div
        v-if="!editing"
        class="flex flex-wrap gap-2"
      >
        <UButton
          label="Exporter en PDF"
          icon="i-lucide-download"
          :loading="exporting"
          @click="exportPdf"
        />
        <UButton
          label="Modifier"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          @click="editing = true; saveError = ''"
        />
      </div>
    </div>
    <p
      v-if="exportError"
      role="alert"
      class="mt-4 text-sm text-error"
    >
      {{ exportError }}
    </p>
    <p
      v-if="!data.client.active"
      class="mt-4 text-sm text-muted"
    >
      Ce client est inactif dans Abby. Le projet est conservé.
    </p>

    <ProjectEditor
      v-if="editing"
      ref="editor"
      class="mt-6"
      :initial="data.project"
      :pending="pending"
      :error="saveError"
      @submit="save"
      @cancel="editing = false"
    />
    <div
      v-else
      class="mt-8 space-y-6"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        Cahier des charges
      </h2>
      <section
        v-for="section in projectSections"
        :key="section.key"
        class="border-t border-default pt-5"
      >
        <h3 class="font-medium text-highlighted">
          {{ section.label }}{{ section.optional ? ' (optionnel)' : '' }}
        </h3>
        <p class="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-muted">
          {{ data.project.specification[section.key] || 'Non renseignée' }}
        </p>
        <DiagramPreview
          v-if="section.key === 'databaseArchitecture' && dbDrawing"
          :drawing="dbDrawing"
          label="Architecture de la base de données"
          class="mt-3"
        />
        <DiagramPreview
          v-if="section.key === 'schedule' && planningDrawing"
          :drawing="planningDrawing"
          label="Décomposition du projet en tâches (WBS)"
          class="mt-3"
          tree
        />
      </section>
    </div>
  </UContainer>
</template>
