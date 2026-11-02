<script setup lang="ts">
import type { Prospect, ProspectInput, ProspectList } from '../../shared/types/prospects'

useSeoMeta({ title: 'Prospects | Abby Projects' })

const page = ref(1)
const search = ref('')
const searchInput = ref('')
const { data, status, error, refresh } = await useFetch<ProspectList>('/api/prospects', {
  query: { page, search }
})
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / (data.value?.pageSize ?? 50))))
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const notice = ref('')
const deleting = ref(false)
const deleteTarget = ref<Prospect | null>(null)
const deleteError = ref('')
const form = reactive({ name: '', email: '', phone: '', domain: '', websiteUrl: '', idea: '' })

function openForm(prospect?: Prospect) {
  editingId.value = prospect?.id ?? null
  Object.assign(form, {
    name: prospect?.name ?? '', email: prospect?.email ?? '', phone: prospect?.phone ?? '',
    domain: prospect?.domain ?? '', websiteUrl: prospect?.websiteUrl ?? '', idea: prospect?.idea ?? ''
  })
  formError.value = ''
  formOpen.value = true
}

function applySearch() {
  page.value = 1
  search.value = searchInput.value.trim()
}

function errorMessage(cause: unknown, fallback: string) {
  return (cause as { data?: { message?: string } }).data?.message || fallback
}

async function save() {
  if (saving.value) return
  saving.value = true
  formError.value = ''
  notice.value = ''
  try {
    const body: ProspectInput = { ...form, websiteUrl: form.websiteUrl.trim() || null }
    if (editingId.value) {
      await $fetch(`/api/prospects/${editingId.value}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/prospects', { method: 'POST', body })
      page.value = 1
      searchInput.value = ''
      search.value = ''
    }
    formOpen.value = false
    notice.value = 'Prospect enregistré.'
    await refresh()
  } catch (cause) {
    formError.value = errorMessage(cause, 'Impossible d’enregistrer le prospect.')
  } finally {
    saving.value = false
  }
}

function confirmDelete(prospect: Prospect) {
  deleteTarget.value = prospect
  deleteError.value = ''
}

async function remove() {
  if (!deleteTarget.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  notice.value = ''
  try {
    await $fetch(`/api/prospects/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteTarget.value = null
    notice.value = 'Prospect supprimé.'
    if (data.value?.prospects.length === 1 && page.value > 1) page.value--
    await refresh()
  } catch (cause) {
    deleteError.value = errorMessage(cause, 'Impossible de supprimer le prospect.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
          Prospects
        </h1>
        <p class="mt-2 text-sm text-muted">
          Vos contacts à démarcher, enregistrés uniquement dans votre base de données.
        </p>
      </div>
      <UButton
        label="Ajouter un prospect"
        icon="i-lucide-plus"
        @click="openForm()"
      />
    </div>

    <p
      v-if="notice"
      role="status"
      class="mt-4 text-sm"
    >
      {{ notice }}
    </p>

    <form
      class="mt-6 flex flex-wrap items-end gap-2"
      @submit.prevent="applySearch"
    >
      <UFormField
        label="Rechercher"
        name="search"
        class="w-full sm:w-80"
      >
        <UInput
          v-model="searchInput"
          placeholder="Nom, domaine, contact ou idée"
          maxlength="200"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        label="Rechercher"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
      />
    </form>

    <section
      aria-label="Prospects"
      :aria-busy="status === 'pending'"
      class="mt-4 overflow-hidden rounded-lg border border-default"
    >
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full min-w-2xl text-left text-sm">
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
                Contact
              </th>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Domaine
              </th>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Site web actuel
              </th>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Idée
              </th>
              <th
                scope="col"
                class="px-4 py-3 font-medium"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="error || status === 'pending' || !data?.prospects.length">
              <td
                colspan="6"
                class="px-6 py-12 text-center"
              >
                <template v-if="error">
                  <p
                    role="alert"
                    class="text-error"
                  >
                    Impossible de charger les prospects.
                  </p>
                  <UButton
                    label="Réessayer"
                    color="neutral"
                    variant="outline"
                    class="mt-3"
                    @click="refresh()"
                  />
                </template>
                <p
                  v-else-if="status === 'pending'"
                  role="status"
                  class="text-muted"
                >
                  Chargement des prospects…
                </p>
                <p
                  v-else
                  class="text-muted"
                >
                  {{ search ? 'Aucun prospect ne correspond à votre recherche.' : 'Aucun prospect pour le moment.' }}
                </p>
              </td>
            </tr>
            <template v-else>
              <tr
                v-for="prospect in data.prospects"
                :key="prospect.id"
                class="border-b border-default last:border-0"
              >
                <td class="px-4 py-3 font-medium break-words text-highlighted">
                  {{ prospect.name }}
                </td>
                <td class="px-4 py-3">
                  <a
                    v-if="prospect.email"
                    :href="`mailto:${prospect.email}`"
                    class="block break-all underline-offset-4 hover:underline"
                  >{{ prospect.email }}</a>
                  <a
                    v-if="prospect.phone"
                    :href="`tel:${prospect.phone.replace(/[^\d+]/g, '')}`"
                    class="block whitespace-nowrap underline-offset-4 hover:underline"
                  >{{ prospect.phone }}</a>
                </td>
                <td class="px-4 py-3 break-words text-muted">
                  {{ prospect.domain }}
                </td>
                <td class="max-w-64 px-4 py-3">
                  <a
                    v-if="prospect.websiteUrl"
                    :href="prospect.websiteUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="break-all underline-offset-4 hover:underline"
                  >{{ prospect.websiteUrl }}</a>
                  <span
                    v-else
                    class="text-muted"
                  >—</span>
                </td>
                <td class="max-w-72 min-w-48 px-4 py-3 whitespace-pre-line text-muted wrap-anywhere">
                  {{ prospect.idea || '—' }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    <UButton
                      label="Modifier"
                      :aria-label="`Modifier ${prospect.name}`"
                      color="neutral"
                      variant="ghost"
                      @click="openForm(prospect)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      :aria-label="`Supprimer ${prospect.name}`"
                      color="error"
                      variant="ghost"
                      @click="confirmDelete(prospect)"
                    />
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div
        v-if="error || status === 'pending' || !data?.prospects.length"
        class="px-5 py-10 text-center text-sm md:hidden"
      >
        <p
          v-if="error"
          role="alert"
          class="text-error"
        >
          Impossible de charger les prospects.
        </p>
        <p
          v-else-if="status === 'pending'"
          role="status"
          class="text-muted"
        >
          Chargement des prospects…
        </p>
        <p
          v-else
          class="text-muted"
        >
          {{ search ? 'Aucun prospect ne correspond à cette recherche.' : 'Aucun prospect. Ajoutez votre premier contact.' }}
        </p>
      </div>
      <ul
        v-else
        class="divide-y divide-default md:hidden"
      >
        <li
          v-for="prospect in data.prospects"
          :key="prospect.id"
          class="space-y-4 p-5"
        >
          <div>
            <h2 class="font-medium text-highlighted">
              {{ prospect.name }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ prospect.domain }}
            </p>
          </div>
          <div class="space-y-2 text-sm">
            <a
              v-if="prospect.email"
              :href="`mailto:${prospect.email}`"
              class="block underline-offset-4 wrap-anywhere hover:underline"
            >{{ prospect.email }}</a>
            <a
              v-if="prospect.phone"
              :href="`tel:${prospect.phone}`"
              class="block hover:underline"
            >{{ prospect.phone }}</a>
            <a
              v-if="prospect.websiteUrl"
              :href="prospect.websiteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 text-muted hover:underline"
            >Ouvrir le site <UIcon
              name="i-lucide-external-link"
              class="size-3"
            /></a>
          </div>
          <p
            v-if="prospect.idea"
            class="text-sm leading-6 text-muted wrap-anywhere"
          >
            {{ prospect.idea }}
          </p>
          <div class="flex gap-2">
            <UButton
              label="Modifier"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              @click="openForm(prospect)"
            />
            <UButton
              icon="i-lucide-trash-2"
              :aria-label="`Supprimer ${prospect.name}`"
              color="error"
              variant="ghost"
              @click="confirmDelete(prospect)"
            />
          </div>
        </li>
      </ul>
    </section>

    <div
      v-if="data?.total"
      class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <span>{{ data.total }} prospect{{ data.total === 1 ? '' : 's' }} · Page {{ page }} sur {{ totalPages }}</span>
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

    <UModal
      v-model:open="formOpen"
      :title="editingId ? 'Modifier le prospect' : 'Ajouter un prospect'"
      description="Renseignez au moins une adresse e-mail ou un numéro de téléphone."
      :dismissible="!saving"
      :close="!saving"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="save"
        >
          <UFormField
            label="Nom"
            name="name"
            required
          >
            <UInput
              v-model="form.name"
              required
              maxlength="200"
              autocomplete="name"
              class="w-full"
              :disabled="saving"
            />
          </UFormField>
          <UFormField
            label="Adresse e-mail"
            name="email"
          >
            <UInput
              v-model="form.email"
              type="email"
              :required="!form.phone.trim()"
              maxlength="254"
              autocomplete="email"
              class="w-full"
              :disabled="saving"
            />
          </UFormField>
          <UFormField
            label="Téléphone"
            name="phone"
          >
            <UInput
              v-model="form.phone"
              type="tel"
              :required="!form.email.trim()"
              maxlength="50"
              autocomplete="tel"
              class="w-full"
              :disabled="saving"
            />
          </UFormField>
          <UFormField
            label="Domaine"
            name="domain"
            required
            description="Secteur d’activité, par exemple : restauration, immobilier…"
          >
            <UInput
              v-model="form.domain"
              required
              maxlength="200"
              class="w-full"
              :disabled="saving"
            />
          </UFormField>
          <UFormField
            label="Site web actuel (facultatif)"
            name="websiteUrl"
          >
            <UInput
              v-model="form.websiteUrl"
              type="url"
              placeholder="https://exemple.fr"
              maxlength="2048"
              autocomplete="url"
              class="w-full"
              :disabled="saving"
            />
          </UFormField>
          <UFormField
            label="Idée (facultatif)"
            name="idea"
            description="Ce que vous aimeriez proposer ou réaliser pour ce prospect."
          >
            <UTextarea
              v-model="form.idea"
              placeholder="Ex. : créer un site vitrine avec prise de rendez-vous."
              maxlength="5000"
              :rows="4"
              class="w-full"
              :disabled="saving"
            />
          </UFormField>
          <p
            v-if="formError"
            role="alert"
            class="text-sm text-error"
          >
            {{ formError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Annuler"
              color="neutral"
              variant="outline"
              :disabled="saving"
              @click="formOpen = false"
            />
            <UButton
              type="submit"
              label="Enregistrer"
              :loading="saving"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      :open="!!deleteTarget"
      title="Supprimer le prospect"
      :description="`Supprimer définitivement ${deleteTarget?.name ?? 'ce prospect'} ?`"
      :dismissible="!deleting"
      :close="!deleting"
      @update:open="value => { if (!value) deleteTarget = null }"
    >
      <template #body>
        <p
          v-if="deleteError"
          role="alert"
          class="mb-4 text-sm text-error"
        >
          {{ deleteError }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Annuler"
            color="neutral"
            variant="outline"
            :disabled="deleting"
            @click="deleteTarget = null"
          />
          <UButton
            label="Supprimer"
            color="error"
            :loading="deleting"
            @click="remove"
          />
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
