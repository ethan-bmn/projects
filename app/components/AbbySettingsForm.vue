<script setup lang="ts">
import type { GlobalSettings } from '#shared/types/settings'

const { data, error, refresh } = await useFetch<GlobalSettings>('/api/settings')
const apiKey = ref('')
useUnsavedChanges(() => Boolean(apiKey.value))
const pending = reactive({ abby: false })
const errors = reactive({ abby: '' })
const messages = reactive({ abby: '' })

type Section = keyof typeof pending

async function save(section: Section, action: () => Promise<void>) {
  if (pending[section]) return
  pending[section] = true
  errors[section] = ''
  messages[section] = ''
  try {
    await action()
    messages[section] = 'Modifications enregistrées.'
  } catch (cause) {
    errors[section] = (cause as { data?: { message?: string } }).data?.message || (cause instanceof Error ? cause.message : 'Enregistrement impossible. Réessayez.')
  } finally {
    pending[section] = false
  }
}

function saveAbby(disable = false) {
  return save('abby', async () => {
    const result = await $fetch('/api/settings/abby', { method: 'PUT', body: { apiKey: disable ? '' : apiKey.value } })
    if (data.value) data.value.abbyConfigured = result.configured
    apiKey.value = ''
  })
}
</script>

<template>
  <div
    v-if="error"
    class="space-y-3"
  >
    <p
      role="alert"
      class="text-sm text-error"
    >
      Impossible de charger les paramètres.
    </p>
    <UButton
      label="Réessayer"
      color="neutral"
      variant="outline"
      @click="refresh()"
    />
  </div>
  <section
    v-else-if="data"
    id="abby"
    aria-labelledby="abby-title"
    class="space-y-5"
  >
    <h2
      id="abby-title"
      class="text-lg font-semibold text-highlighted"
    >
      Connexion Abby
    </h2>
    <p class="mt-2 text-sm text-muted">
      {{ data.abbyConfigured ? 'Une clé API est enregistrée. Saisissez une nouvelle clé pour la remplacer.' : 'Ajoutez votre clé API pour synchroniser vos clients.' }}
    </p>
    <form
      class="mt-5 space-y-4"
      @submit.prevent="saveAbby()"
    >
      <UFormField
        label="Clé API Abby"
        name="abby-api-key"
      >
        <UInput
          v-model="apiKey"
          name="abby-api-key"
          type="password"
          autocomplete="off"
          :maxlength="8192"
          :disabled="pending.abby"
          class="w-full"
          required
        />
      </UFormField>
      <p
        v-if="errors.abby"
        role="alert"
        class="text-sm text-error"
      >
        {{ errors.abby }}
      </p>
      <p
        v-if="messages.abby"
        role="status"
        class="text-sm text-success"
      >
        {{ messages.abby }}
      </p>
      <div class="flex flex-wrap gap-3">
        <UButton
          type="submit"
          label="Enregistrer la clé"
          :loading="pending.abby"
          :disabled="!apiKey.trim()"
        />
        <UButton
          v-if="data.abbyConfigured"
          type="button"
          label="Supprimer la clé"
          color="neutral"
          variant="outline"
          :disabled="pending.abby"
          @click="saveAbby(true)"
        />
      </div>
    </form>
  </section>
</template>
