<script setup lang="ts">
import type { GlobalSettings } from '#shared/types/settings'

const { data, error, refresh } = await useFetch<GlobalSettings>('/api/settings')
const { fetch: refreshSession } = useUserSession()
const account = reactive({ email: '', currentPassword: '', newPassword: '', confirmation: '' })
const savedEmail = ref('')
useUnsavedChanges(() => account.email !== savedEmail.value || Boolean(account.currentPassword || account.newPassword || account.confirmation))
const pending = reactive({ account: false })
const errors = reactive({ account: '' })
const messages = reactive({ account: '' })

watch(data, (settings) => {
  if (!settings) return
  account.email = settings.email
  savedEmail.value = settings.email
}, { immediate: true })

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

function saveAccount() {
  return save('account', async () => {
    if (account.newPassword !== account.confirmation) throw new Error('Les nouveaux mots de passe ne correspondent pas.')
    const result = await $fetch('/api/settings/account', {
      method: 'PUT',
      body: { email: account.email, currentPassword: account.currentPassword, newPassword: account.newPassword }
    })
    account.email = result.email
    if (data.value) data.value.email = result.email
    savedEmail.value = result.email
    account.currentPassword = ''
    account.newPassword = ''
    account.confirmation = ''
    await refreshSession()
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
    id="account"
    aria-labelledby="account-title"
    class="space-y-5"
  >
    <h2
      id="account-title"
      class="text-lg font-semibold text-highlighted"
    >
      Compte
    </h2>
    <p class="mt-2 text-sm text-muted">
      Confirmez votre mot de passe actuel pour modifier vos identifiants. Les autres sessions seront déconnectées après un changement.
    </p>
    <form
      class="mt-5 space-y-4"
      @submit.prevent="saveAccount"
    >
      <fieldset
        :disabled="pending.account"
        class="space-y-4"
      >
        <UFormField
          label="Adresse e-mail de connexion"
          name="account-email"
        >
          <UInput
            v-model="account.email"
            name="account-email"
            type="email"
            autocomplete="username"
            :maxlength="254"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="Mot de passe actuel"
          name="current-password"
        >
          <UInput
            v-model="account.currentPassword"
            name="current-password"
            type="password"
            autocomplete="current-password"
            :maxlength="1024"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="Nouveau mot de passe"
          name="new-password"
          description="Laissez vide pour conserver le mot de passe actuel."
        >
          <UInput
            v-model="account.newPassword"
            name="new-password"
            type="password"
            autocomplete="new-password"
            :maxlength="1024"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Confirmer le nouveau mot de passe"
          name="confirm-password"
        >
          <UInput
            v-model="account.confirmation"
            name="confirm-password"
            type="password"
            autocomplete="new-password"
            :maxlength="1024"
            :required="Boolean(account.newPassword)"
            class="w-full"
          />
        </UFormField>
      </fieldset>
      <p
        v-if="errors.account"
        role="alert"
        class="text-sm text-error"
      >
        {{ errors.account }}
      </p>
      <p
        v-if="messages.account"
        role="status"
        class="text-sm text-success"
      >
        {{ messages.account }}
      </p>
      <UButton
        type="submit"
        label="Enregistrer les identifiants"
        :loading="pending.account"
      />
    </form>
  </section>
</template>
