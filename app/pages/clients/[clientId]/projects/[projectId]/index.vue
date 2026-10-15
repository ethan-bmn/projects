<script setup lang="ts">
import { projectSections } from '#shared/types/projects'
import type { Project, ProjectDetail, ProjectInput } from '#shared/types/projects'
import { databaseDrawing, wbsDrawing } from '#shared/utils/diagrams'
import { projectSvgFilename } from '#shared/utils/project-filenames'
import { contractExportIssues } from '#shared/utils/contracts'

const route = useRoute()
const clientId = String(route.params.clientId)
const projectId = String(route.params.projectId)
const { data, error } = await useFetch<ProjectDetail>(`/api/clients/${clientId}/projects/${projectId}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Projet introuvable.' })
useSeoMeta({ title: () => `${data.value?.project.name} | Abby Projects` })

const editing = ref(false)
const contractError = ref('')
const exportingContract = ref(false)
const contractComplete = computed(() => !!data.value?.project.contract && contractExportIssues(data.value.project.contract).length === 0)
const pending = ref(false)
const saveError = ref('')
const exporting = ref(false)
const exportingSvg = ref(false)
const exportError = ref('')
const config = useRuntimeConfig()
const editor = useTemplateRef<{ markSaved: () => void }>('editor')
const dbDrawing = computed(() => data.value?.project.diagrams?.database ? databaseDrawing(data.value.project.diagrams.database) : null)
const planningDrawing = computed(() => data.value?.project.diagrams?.wbs.length ? wbsDrawing(data.value.project.diagrams.wbs) : null)

async function exportContract() {
  if (exportingContract.value || !data.value) return
  exportingContract.value = true
  contractError.value = ''
  try {
    const { downloadContractPdf } = await import('~/lib/contract-pdf')
    await downloadContractPdf(data.value, config.app.baseURL)
  } catch (cause) {
    contractError.value = cause instanceof Error ? cause.message : 'Impossible de générer le contrat PDF.'
  } finally {
    exportingContract.value = false
  }
}

async function exportDatabaseSvg() {
  if (exportingSvg.value || !data.value) return
  exportingSvg.value = true
  exportError.value = ''
  try {
    const svg = await $fetch<Blob>(`/api/clients/${clientId}/projects/${projectId}/database.svg`, { method: 'POST', responseType: 'blob' })
    const url = URL.createObjectURL(svg)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = projectSvgFilename(data.value.project.name)
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    exportError.value = 'Impossible de générer le SVG. Vérifiez que les services Docker ChartDB sont démarrés, puis réessayez.'
  } finally {
    exportingSvg.value = false
  }
}

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

    <section
      v-if="!editing"
      class="mt-6 space-y-4 border-y border-default py-5"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-highlighted">
          Contrat
        </h2>
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="data.project.contract ? 'Modifier le contrat' : 'Créer le contrat'"
            color="neutral"
            variant="outline"
            :to="`/clients/${clientId}/projects/${projectId}/contract`"
          />
          <UButton
            v-if="data.project.contract"
            label="Exporter le contrat PDF"
            icon="i-lucide-download"
            :disabled="!contractComplete"
            :loading="exportingContract"
            @click="exportContract"
          />
        </div>
      </div>
      <p
        class="text-sm text-muted"
      >
        {{ !data.project.contract ? 'Aucun contrat associé à ce projet.' : contractComplete ? `Contrat prêt à exporter. Devis joint : ${data.project.contract.quote?.name}` : data.project.contract.version === 1 ? 'Ancien modèle : ouvrez le contrat pour vérifier le nouveau paramétrage.' : 'Brouillon : complétez le paramétrage et les vérifications avant l’export.' }}
      </p>
      <p
        v-if="contractError"
        role="alert"
        class="text-sm text-error"
      >
        {{ contractError }}
      </p>
    </section>

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
        <UButton
          v-if="section.key === 'databaseArchitecture' && dbDrawing"
          label="Exporter le SVG avec ChartDB"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          class="mt-3"
          :loading="exportingSvg"
          @click="exportDatabaseSvg"
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
