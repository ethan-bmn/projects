<script setup lang="ts">
import type { Project, ProjectDetail } from '#shared/types/projects'
import type { ProjectContract } from '#shared/types/contracts'

const route = useRoute()
const clientId = String(route.params.clientId)
const projectId = String(route.params.projectId)
const projectPath = `/clients/${clientId}/projects/${projectId}`
const { data, error } = await useFetch<ProjectDetail>(`/api/clients/${clientId}/projects/${projectId}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Projet introuvable.' })
const title = data.value.project.contract ? 'Modifier le contrat' : 'Créer le contrat'
useSeoMeta({ title: () => `${title} · ${data.value?.project.name} | Abby Projects` })

const pending = ref(false)
const saveError = ref('')
const editor = useTemplateRef<{ markSaved: () => void }>('editor')

async function save(contract: ProjectContract) {
  if (pending.value || !data.value) return
  pending.value = true
  saveError.value = ''
  try {
    const project = await $fetch<Project>(`/api/clients/${clientId}/projects/${projectId}`, {
      method: 'PUT', body: { name: data.value.project.name, specification: data.value.project.specification, contract }
    })
    editor.value?.markSaved()
    data.value.project = project
    await navigateTo(projectPath)
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible d’enregistrer le contrat. Réessayez.'
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
      :to="projectPath"
      class="text-sm text-muted underline-offset-4 hover:underline"
    >{{ data.project.name }} · Retour au projet</NuxtLink>
    <h1 class="mt-5 text-2xl font-semibold tracking-tight text-highlighted">
      {{ title }}
    </h1>
    <p class="mt-2 text-sm text-muted">
      {{ data.client.name }} · {{ data.project.name }}
    </p>
    <ContractEditor
      ref="editor"
      class="mt-6"
      :client="data.client"
      :initial="data.project.contract"
      :pending="pending"
      :error="saveError"
      @submit="save"
      @cancel="navigateTo(projectPath)"
    />
  </UContainer>
</template>
