<script setup lang="ts">
import type { ClientProjects } from '#shared/types/projects'

const route = useRoute()
const clientId = String(route.params.clientId)
const { data, error } = await useFetch<ClientProjects>(`/api/clients/${clientId}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Client introuvable.' })
useSeoMeta({ title: () => `${data.value?.client.name} | Abby Projects` })

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value))
}
</script>

<template>
  <UContainer
    v-if="data"
    class="py-8"
  >
    <NuxtLink
      to="/"
      class="text-sm text-muted underline-offset-4 hover:underline"
    >Retour aux clients</NuxtLink>
    <div class="mt-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
          {{ data.client.name }}
        </h1>
        <p class="mt-2 text-sm text-muted">
          {{ data.client.kind === 'organization' ? 'Entreprise' : 'Particulier' }} · {{ data.client.emails.join(', ') || 'Aucune adresse e-mail' }}
        </p>
      </div>
      <UButton
        label="Nouveau projet"
        icon="i-lucide-plus"
        :to="`/clients/${clientId}/projects/new`"
      />
    </div>
    <p
      v-if="!data.client.active"
      class="mt-4 text-sm text-muted"
    >
      Ce client est inactif dans Abby. Ses projets restent accessibles.
    </p>

    <h2 class="mt-8 text-lg font-semibold text-highlighted">
      Projets
    </h2>
    <p
      v-if="!data.projects.length"
      class="mt-4 rounded-lg border border-default px-4 py-8 text-sm text-muted"
    >
      Aucun projet pour ce client. Créez son premier projet.
    </p>
    <ul
      v-else
      class="mt-4 divide-y divide-default overflow-hidden rounded-lg border border-default"
    >
      <li
        v-for="project in data.projects"
        :key="project.id"
      >
        <NuxtLink
          :to="`/clients/${clientId}/projects/${project.id}`"
          class="flex flex-wrap items-center justify-between gap-2 px-4 py-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span class="font-medium text-highlighted">{{ project.name }}</span>
          <span class="text-sm text-muted">Modifié le {{ formatDate(project.updatedAt) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </UContainer>
</template>
