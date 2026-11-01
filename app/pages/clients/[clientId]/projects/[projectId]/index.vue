<script setup lang="ts">
import type { Project, ProjectDetail, ProjectInput } from '#shared/types/projects'
import type { AbbyQuote } from '#shared/types/quotes'

const route = useRoute()
const clientId = String(route.params.clientId)
const projectId = String(route.params.projectId)
const endpoint = `/api/clients/${clientId}/projects/${projectId}`
const { data, error } = await useFetch<ProjectDetail>(endpoint)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, message: 'Projet introuvable.' })
useSeoMeta({ title: () => `${data.value?.project.name} | Abby Projects` })
const editing = ref(false)
const pending = ref(false)
const saveError = ref('')
const { data: quote, error: quoteError, status: quoteStatus, refresh: refreshQuote } = await useFetch<AbbyQuote | null>(`${endpoint}/quote`, { server: false, lazy: true })
const quoteErrorMessage = computed(() => (quoteError.value?.data as { message?: string } | undefined)?.message || 'Impossible de récupérer le devis Abby.')
const states: Record<string, string> = { draft: 'Brouillon', finalized: 'Finalisé', signed: 'Signé', refused: 'Refusé', paid: 'Payé' }
const amount = computed(() => quote.value ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: quote.value.currencyCode }).format(quote.value.amountWithTax / 100) : '')

async function save(input: ProjectInput) {
  if (pending.value) return
  pending.value = true
  saveError.value = ''
  try {
    data.value!.project = await $fetch<Project>(endpoint, { method: 'PUT', body: input })
    editing.value = false
    await refreshQuote()
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
    >
      {{ data.client.name }} · Retour aux projets
    </NuxtLink>
    <div class="mt-5 flex flex-wrap items-start justify-between gap-4">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ data.project.name }}
      </h1>
      <UButton
        v-if="!editing"
        label="Modifier le projet"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        @click="editing = true; saveError = ''"
      />
    </div>
    <p
      v-if="!data.client.active"
      class="mt-4 text-sm text-muted"
    >
      Ce client est inactif dans Abby. Le projet est conservé.
    </p>
    <ProjectDetailsEditor
      v-if="editing"
      class="mt-6"
      :client-id="clientId"
      :initial="data.project"
      :pending="pending"
      :error="saveError"
      @submit="save"
      @cancel="editing = false"
    />
    <div
      v-else
      class="mt-8 space-y-8"
    >
      <section class="space-y-3 border-t border-default pt-5">
        <h2 class="text-lg font-semibold text-highlighted">
          Devis Abby
        </h2>
        <p
          v-if="!data.project.quoteId"
          class="text-sm text-muted"
        >
          Aucun devis associé.
        </p>
        <p
          v-else-if="quoteStatus === 'pending'"
          role="status"
          class="text-sm text-muted"
        >
          Chargement du devis depuis Abby…
        </p>
        <div
          v-else-if="quoteError"
          role="alert"
          class="space-y-3"
        >
          <p class="text-sm text-error">
            {{ quoteErrorMessage }}
          </p>
          <UButton
            label="Réessayer"
            color="neutral"
            variant="outline"
            @click="refreshQuote()"
          />
        </div>
        <dl
          v-else-if="quote"
          class="space-y-2 text-sm"
        >
          <div class="flex flex-wrap gap-2">
            <dt class="text-muted">
              Numéro :
            </dt><dd>{{ quote.number || 'Brouillon' }}</dd>
          </div>
          <div
            v-if="quote.title"
            class="flex flex-wrap gap-2"
          >
            <dt class="text-muted">
              Objet :
            </dt><dd>{{ quote.title }}</dd>
          </div>
          <div class="flex flex-wrap gap-2">
            <dt class="text-muted">
              État :
            </dt><dd>{{ states[quote.state] || quote.state }}</dd>
          </div>
          <div class="flex flex-wrap gap-2">
            <dt class="text-muted">
              Montant TTC :
            </dt><dd>{{ amount }}</dd>
          </div>
          <UButton
            label="Actualiser depuis Abby"
            color="neutral"
            variant="outline"
            @click="refreshQuote()"
          />
        </dl>
      </section>
      <section class="space-y-3 border-t border-default pt-5">
        <h2 class="text-lg font-semibold text-highlighted">
          Cahier des charges
        </h2>
        <p class="text-sm text-muted">
          {{ data.project.specification ? 'Un cahier des charges est associé à ce projet.' : 'Aucun cahier des charges. Vous pouvez en ajouter un quand vous en avez besoin.' }}
        </p>
        <UButton
          :label="data.project.specification ? 'Ouvrir le cahier des charges' : 'Configurer le cahier des charges'"
          :to="`/clients/${clientId}/projects/${projectId}/specification`"
        />
      </section>
    </div>
  </UContainer>
</template>
