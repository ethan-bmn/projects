<script setup lang="ts">
import type { ContractFieldHelp } from '#shared/utils/contract-field-help'

defineProps<{ label: string, help: ContractFieldHelp }>()
</script>

<template>
  <UPopover :content="{ side: 'bottom', align: 'end' }">
    <UButton
      type="button"
      icon="i-lucide-info"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="`Aide : ${label}`"
    />
    <template #content>
      <div class="max-w-xs space-y-2 p-3 text-sm">
        <p class="font-medium text-highlighted">
          {{ label }}
        </p>
        <p>{{ help.explanation }}</p>
        <p class="text-muted">
          <span class="font-medium">Exemple :</span> {{ help.example }}
        </p>
      </div>
    </template>
  </UPopover>
</template>
