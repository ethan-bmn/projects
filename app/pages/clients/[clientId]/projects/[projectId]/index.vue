<script setup lang="ts">
import type { ProjectDetail } from '#shared/types/projects'

const route = useRoute()
const clientId = String(route.params.clientId)
const projectId = String(route.params.projectId)
const base = `/clients/${clientId}/projects/${projectId}`
const { data, error } = await useFetch<ProjectDetail>(`/api${base}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Projet introuvable.' })
useSeoMeta({ title: () => `${data.value?.project.name} | Abby Projects` })
const updatedAt = computed(() => data.value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(data.value.project.updatedAt)) : '')
</script>

<template>
  <UContainer
    v-if="data"
    class="max-w-5xl py-8"
  >
    <ProjectHeader :detail="data">
      <UButton
        :to="`${base}/edit`"
        label="Modifier le projet"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
      />
    </ProjectHeader>
    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <section aria-labelledby="project-documents">
        <h2
          id="project-documents"
          class="text-lg font-semibold text-highlighted"
        >
          Documents du projet
        </h2>
        <div class="mt-5 divide-y divide-default border-y border-default">
          <div class="flex items-start gap-4 py-6">
            <UIcon
              name="i-lucide-file-text"
              class="mt-1 size-5 shrink-0 text-muted"
            />
            <div class="min-w-0 flex-1">
              <h3 class="font-medium text-highlighted">
                Devis et signature
              </h3>
              <p class="mt-2 text-sm leading-6 text-muted">
                {{ data.project.quoteId ? 'Un devis Abby est associé. Consultez-le, envoyez-le par e-mail ou demandez une signature.' : 'Associez un devis Abby pour l’envoyer au client et demander sa signature.' }}
              </p>
              <UButton
                :to="`${base}/quote`"
                :label="data.project.quoteId ? 'Ouvrir le devis' : 'Associer un devis'"
                color="neutral"
                variant="outline"
                class="mt-4"
                trailing-icon="i-lucide-arrow-right"
              />
            </div>
          </div>
          <div class="flex items-start gap-4 py-6">
            <UIcon
              name="i-lucide-notebook-pen"
              class="mt-1 size-5 shrink-0 text-muted"
            />
            <div class="min-w-0 flex-1">
              <h3 class="font-medium text-highlighted">
                Cahier des charges
              </h3>
              <p class="mt-2 text-sm leading-6 text-muted">
                {{ data.project.specification ? 'Retrouvez le périmètre, les besoins, l’architecture et le planning du projet.' : 'Précisez les besoins et les livrables du projet quand vous êtes prêt.' }}
              </p>
              <UButton
                :to="`${base}/specification`"
                :label="data.project.specification ? 'Ouvrir le cahier des charges' : 'Configurer le cahier des charges'"
                color="neutral"
                variant="outline"
                class="mt-4"
                trailing-icon="i-lucide-arrow-right"
              />
            </div>
          </div>
        </div>
      </section>
      <aside class="space-y-6 text-sm">
        <div>
          <h2 class="font-medium text-highlighted">
            Client
          </h2>
          <NuxtLink
            :to="`/clients/${clientId}`"
            class="mt-2 block text-muted underline-offset-4 hover:underline"
          >{{ data.client.name }}</NuxtLink>
          <a
            v-for="email in data.client.emails"
            :key="email"
            :href="`mailto:${email}`"
            class="mt-1 block text-muted underline-offset-4 wrap-anywhere hover:underline"
          >{{ email }}</a>
        </div>
        <div>
          <h2 class="font-medium text-highlighted">
            Dernière modification
          </h2><p class="mt-2 text-muted">
            {{ updatedAt }}
          </p>
        </div>
      </aside>
    </div>
  </UContainer>
</template>
