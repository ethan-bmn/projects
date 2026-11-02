<script setup lang="ts">
import type { Project, ProjectDetail, ProjectInput } from '#shared/types/projects'

const route = useRoute()
const clientId = String(route.params.clientId)
const projectId = String(route.params.projectId)
const base = `/clients/${clientId}/projects/${projectId}`
const { data, error } = await useFetch<ProjectDetail>(`/api${base}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Projet introuvable.' })
useSeoMeta({ title: 'Modifier le projet | Abby Projects' })
const pending = ref(false)
const saveError = ref('')
async function save(input: ProjectInput) {
  if (pending.value) return
  pending.value = true
  saveError.value = ''
  try {
    data.value!.project = await $fetch<Project>(`/api${base}`, { method: 'PUT', body: input })
    await navigateTo(base)
  } catch (cause) {
    saveError.value = (cause as { data?: { message?: string } }).data?.message || 'Impossible d’enregistrer le projet.'
  } finally { pending.value = false }
}
</script>

<template>
  <UContainer
    v-if="data"
    class="max-w-5xl py-8"
  >
    <ProjectHeader :detail="data" />
    <div class="max-w-2xl">
      <h2 class="text-lg font-semibold text-highlighted">
        Informations du projet
      </h2>
      <ProjectDetailsEditor
        class="mt-6"
        :client-id="clientId"
        :initial="data.project"
        :pending="pending"
        :error="saveError"
        @submit="save"
        @cancel="navigateTo(base)"
      />
    </div>
  </UContainer>
</template>
