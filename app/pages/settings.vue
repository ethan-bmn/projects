<script setup lang="ts">
import type { GlobalSettings } from '#shared/types/settings'
import type { ProviderProfile } from '#shared/types/provider'

useSeoMeta({ title: 'Paramètres | Abby Projects' })

const { data, error, refresh } = await useFetch<GlobalSettings>('/api/settings')
const { fetch: refreshSession } = useUserSession()
const provider = reactive<ProviderProfile>({ name: '', siren: '', address: '', email: '', phone: '' })
const account = reactive({ email: '', currentPassword: '', newPassword: '', confirmation: '' })
const apiKey = ref('')
const pending = reactive({ provider: false, account: false, abby: false })
const errors = reactive({ provider: '', account: '', abby: '' })
const messages = reactive({ provider: '', account: '', abby: '' })

watch(data, (settings) => {
  if (!settings) return
  Object.assign(provider, settings.provider)
  account.email = settings.email
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

function saveProvider() {
  return save('provider', async () => {
    await $fetch('/api/settings/provider', { method: 'PUT', body: { ...provider } })
  })
}

function saveAbby(disable = false) {
  return save('abby', async () => {
    const result = await $fetch('/api/settings/abby', { method: 'PUT', body: { apiKey: disable ? '' : apiKey.value } })
    if (data.value) data.value.abbyConfigured = result.configured
    apiKey.value = ''
  })
}

function saveAccount() {
  return save('account', async () => {
    if (account.newPassword !== account.confirmation) throw new Error('Les nouveaux mots de passe ne correspondent pas.')
    const result = await $fetch('/api/settings/account', {
      method: 'PUT',
      body: { email: account.email, currentPassword: account.currentPassword, newPassword: account.newPassword }
    })
    account.email = result.email
    account.currentPassword = ''
    account.newPassword = ''
    account.confirmation = ''
    await refreshSession()
  })
}
</script>

<template>
  <UContainer class="py-8">
    <div class="max-w-2xl">
      <UButton
        to="/"
        label="Retour aux clients"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        class="mb-4 px-0"
      />
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Paramètres
      </h1>

      <div
        v-if="error"
        class="mt-6 space-y-3"
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

      <div
        v-else-if="data"
        class="mt-8 divide-y divide-default"
      >
        <section
          id="abby"
          aria-labelledby="abby-title"
          class="pb-8"
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

        <section
          id="provider"
          aria-labelledby="provider-title"
          class="py-8"
        >
          <h2
            id="provider-title"
            class="text-lg font-semibold text-highlighted"
          >
            Coordonnées du prestataire
          </h2>
          <p class="mt-2 text-sm text-muted">
            Ces coordonnées sont utilisées dans les contrats. L’adresse e-mail de contact est indépendante de votre identifiant de connexion.
          </p>
          <form
            class="mt-5 space-y-4"
            @submit.prevent="saveProvider"
          >
            <fieldset
              :disabled="pending.provider"
              class="space-y-4"
            >
              <UFormField
                label="Nom ou raison sociale"
                name="provider-name"
              >
                <UInput
                  v-model="provider.name"
                  name="provider-name"
                  autocomplete="organization"
                  :maxlength="200"
                  class="w-full"
                  required
                />
              </UFormField>
              <UFormField
                label="SIREN"
                name="provider-siren"
              >
                <UInput
                  v-model="provider.siren"
                  name="provider-siren"
                  inputmode="numeric"
                  pattern="[0-9]{9}"
                  :maxlength="9"
                  class="w-full sm:w-64"
                  required
                />
              </UFormField>
              <UFormField
                label="Adresse professionnelle"
                name="provider-address"
              >
                <UTextarea
                  v-model="provider.address"
                  name="provider-address"
                  autocomplete="street-address"
                  :maxlength="2000"
                  :rows="3"
                  class="w-full"
                  required
                />
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField
                  label="Adresse e-mail de contact"
                  name="provider-email"
                >
                  <UInput
                    v-model="provider.email"
                    name="provider-email"
                    type="email"
                    autocomplete="email"
                    :maxlength="254"
                    class="w-full"
                    required
                  />
                </UFormField>
                <UFormField
                  label="Téléphone (facultatif)"
                  name="provider-phone"
                >
                  <UInput
                    v-model="provider.phone"
                    name="provider-phone"
                    type="tel"
                    autocomplete="tel"
                    :maxlength="50"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </fieldset>
            <p
              v-if="errors.provider"
              role="alert"
              class="text-sm text-error"
            >
              {{ errors.provider }}
            </p>
            <p
              v-if="messages.provider"
              role="status"
              class="text-sm text-success"
            >
              {{ messages.provider }}
            </p>
            <UButton
              type="submit"
              label="Enregistrer les coordonnées"
              :loading="pending.provider"
            />
          </form>
        </section>

        <section
          id="account"
          aria-labelledby="account-title"
          class="py-8"
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
                description="12 caractères minimum. Laissez vide pour conserver le mot de passe actuel."
              >
                <UInput
                  v-model="account.newPassword"
                  name="new-password"
                  type="password"
                  autocomplete="new-password"
                  :minlength="12"
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
                  :minlength="12"
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
      </div>
    </div>
  </UContainer>
</template>
