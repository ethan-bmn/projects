<script setup lang="ts">
import type { ClientKind, ClientList } from '../../shared/types/clients'

useSeoMeta({ title: 'Clients | Abby Projects' })

const page = ref(1)
const kind = ref<ClientKind | 'all'>('all')
const clientTypes = [
  { label: 'Tous les clients', value: 'all' },
  { label: 'Entreprises', value: 'organization' },
  { label: 'Particuliers', value: 'individual' }
]
watch(kind, () => {
  page.value = 1
})
const { data, status, error, refresh } = await useFetch<ClientList>('/api/clients', {
  query: { page, kind }
})
const syncing = ref(false)
const syncError = ref('')
const syncMessage = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / (data.value?.pageSize ?? 50))))
const lastSync = computed(() => {
  const timestamp = data.value?.sync.lastSuccessAt
  return timestamp
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris'
      }).format(new Date(timestamp))
    : null
})

async function synchronize() {
  if (syncing.value) return
  syncing.value = true
  syncError.value = ''
  syncMessage.value = ''
  try {
    const result = await $fetch('/api/clients/sync', { method: 'POST' })
    if (result.status === 'success') {
      syncMessage.value = `${result.count} client${result.count === 1 ? '' : 's'} synchronisé${result.count === 1 ? '' : 's'}.`
      page.value = 1
    }
  } catch (cause) {
    const response = cause as { data?: { message?: string } }
    syncError.value = response.data?.message || 'La synchronisation a échoué. Réessayez plus tard.'
  } finally {
    await refresh()
    syncing.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
          Clients
        </h1>
        <p class="mt-2 text-sm text-muted">
          Vos clients Abby et leurs projets.
        </p>
      </div>
      <UButton
        label="Synchroniser les clients"
        icon="i-lucide-refresh-cw"
        :loading="syncing"
        :disabled="!data?.sync.configured || status === 'pending'"
        @click="synchronize"
      />
    </div>

    <p
      v-if="data && !data.sync.configured"
      class="mt-4 text-sm text-muted"
    >
      La connexion à Abby n’est pas encore configurée.
    </p>
    <p
      v-else-if="data"
      class="mt-4 text-sm text-muted"
    >
      {{ lastSync ? `Dernière synchronisation : ${lastSync}.` : 'Aucune synchronisation effectuée.' }}
      Mise à jour automatique quotidienne.
    </p>
    <p
      v-if="syncMessage"
      role="status"
      class="mt-3 text-sm"
    >
      {{ syncMessage }}
    </p>
    <p
      v-if="syncError || data?.sync.lastError"
      role="alert"
      class="mt-3 text-sm text-error"
    >
      {{ syncError || data?.sync.lastError }}
    </p>

    <UFormField
      label="Type de client"
      name="kind"
      class="mt-6"
    >
      <USelect
        v-model="kind"
        :items="clientTypes"
        :disabled="status === 'pending'"
        class="w-full sm:w-56"
      />
    </UFormField>

    <section
      aria-label="Clients"
      :aria-busy="status === 'pending'"
      class="mt-4 overflow-hidden rounded-lg border border-default"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-default bg-muted text-muted">
            <tr>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Nom
              </th>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Adresse e-mail
              </th>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="error || status === 'pending' || !data?.clients.length">
              <td
                colspan="3"
                class="px-6 py-16 text-center"
              >
                <p
                  v-if="error"
                  role="alert"
                  class="text-error"
                >
                  Impossible de charger les clients.
                </p>
                <p
                  v-else-if="status === 'pending'"
                  role="status"
                  class="text-muted"
                >
                  Chargement des clients…
                </p>
                <template v-else>
                  <UIcon
                    name="i-lucide-users"
                    class="mb-3 size-6 text-muted"
                    aria-hidden="true"
                  />
                  <p class="font-medium text-highlighted">
                    {{ kind === 'all' ? 'Aucun client pour le moment' : 'Aucun client de ce type' }}
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    Les clients importés apparaîtront ici après la synchronisation.
                  </p>
                </template>
              </td>
            </tr>
            <template v-else>
              <tr
                v-for="client in data.clients"
                :key="client.id"
                class="border-b border-default last:border-0"
              >
                <td class="px-4 py-3 font-medium text-highlighted">
                  {{ client.name || 'Sans nom' }}
                  <p
                    v-if="client.commercialName && client.commercialName !== client.name"
                    class="mt-1 text-sm font-normal text-muted"
                  >
                    {{ client.commercialName }}
                  </p>
                </td>
                <td class="px-4 py-3 text-muted">
                  {{ client.emails.join(', ') || '—' }}
                </td>
                <td class="px-4 py-3 text-muted">
                  {{ client.kind === 'organization' ? 'Entreprise' : 'Particulier' }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="data?.total"
      class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <span>{{ data.total }} client{{ data.total === 1 ? '' : 's' }} · Page {{ page }} sur {{ totalPages }}</span>
      <div
        v-if="totalPages > 1"
        class="flex gap-2"
      >
        <UButton
          label="Précédent"
          color="neutral"
          variant="outline"
          :disabled="page <= 1 || status === 'pending'"
          @click="page--"
        />
        <UButton
          label="Suivant"
          color="neutral"
          variant="outline"
          :disabled="page >= totalPages || status === 'pending'"
          @click="page++"
        />
      </div>
    </div>
  </UContainer>
</template>
