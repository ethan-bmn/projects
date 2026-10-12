<script setup lang="ts">
const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')
const { fetch: refreshSession, loggedIn } = useUserSession()

useSeoMeta({ title: 'Connexion | Abby Projects' })

async function signIn() {
  if (pending.value) return
  pending.value = true
  error.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    password.value = ''
    await refreshSession()
    if (!loggedIn.value) throw new Error('Session unavailable')
    await navigateTo('/', { replace: true })
  } catch {
    password.value = ''
    error.value = 'Connexion impossible. Vérifiez vos identifiants et réessayez.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="flex min-h-svh items-center justify-center p-6">
    <div class="w-full max-w-sm rounded-lg border border-default bg-muted p-6">
      <h1 class="text-xl font-semibold tracking-tight text-highlighted">
        Connexion
      </h1>
      <p class="mt-2 mb-6 text-sm text-muted">
        Connectez-vous à votre espace Abby Projects.
      </p>

      <form
        class="space-y-4"
        @submit.prevent="signIn"
      >
        <UFormField
          label="Adresse e-mail"
          name="email"
        >
          <UInput
            v-model="email"
            name="email"
            type="email"
            autocomplete="username"
            :maxlength="254"
            class="w-full"
            required
            :disabled="pending"
          />
        </UFormField>

        <UFormField
          label="Mot de passe"
          name="password"
        >
          <UInput
            v-model="password"
            name="password"
            type="password"
            autocomplete="current-password"
            :maxlength="1024"
            class="w-full"
            required
            :disabled="pending"
          />
        </UFormField>

        <p
          v-if="error"
          role="alert"
          class="rounded-md border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {{ error }}
        </p>

        <UButton
          type="submit"
          label="Se connecter"
          :loading="pending"
          block
        />
      </form>
    </div>
  </section>
</template>
