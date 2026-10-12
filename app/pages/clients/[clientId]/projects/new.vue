<script setup lang="ts">
import type { ClientProjects, Project, ProjectInput } from '#shared/types/projects'

const route = useRoute()
const clientId = String(route.params.clientId)
const { data, error } = await useFetch<ClientProjects>(`/api/clients/${clientId}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Client introuvable.' })
useSeoMeta({ title: 'Nouveau projet | Abby Projects' })

const pending = ref(false)
const saveError = ref('')
const editor = useTemplateRef<{ markSaved: () => void }>('editor')

async function save(input: ProjectInput) {
  if (pending.value) return
  pending.value = true
  saveError.value = ''
  try {
    const project = await $fetch<Project>(`/api/clients/${clientId}/projects`, { method: 'POST', body: input })
    editor.value?.markSaved()
    await navigateTo(`/clients/${clientId}/projects/${project.id}`)
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
    <h1 class="mt-5 text-2xl font-semibold tracking-tight text-highlighted">
      Nouveau projet
    </h1>
    <ProjectEditor
      ref="editor"
      class="mt-6"
      :pending="pending"
      :error="saveError"
      @submit="save"
      @cancel="navigateTo(`/clients/${clientId}`)"
    />
  </UContainer>
</template>
