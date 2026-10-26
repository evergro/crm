
<template>
  <SettingsLayoutBase>
    <template #title>
      <div class="flex gap-1 items-center">
        <Button
          variant="ghost"
          icon-left="lucide-chevron-left"
          :label="__('FreePBX Settings')"
          size="md"
          class="cursor-pointer -ml-4 hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:none active:bg-transparent active:outline-none active:ring-0 active:ring-offset-0 active:text-ink-gray-5 text-2xl-semibold hover:opacity-70 !pr-0 !max-w-96 !justify-start"
          @click="emit('updateStep', 'telephony-settings')"
        />
        <Badge
          v-if="settings.doc?.enabled && isDirty"
          :label="__('Not Saved')"
          variant="subtle"
          theme="amber"
        />
      </div>
    </template>

    <template #header-actions>
      <div
        v-if="settings.doc && !settings.get.loading"
        class="flex gap-2"
      >
        <template v-if="settings.doc.enabled">
          <Button
            v-if="isDirty"
            :label="__('Discard Changes')"
            variant="subtle"
            @click="settings.reload()"
          />
          <Button
            :label="__('Disable')"
            variant="subtle"
            @click="disable"
          />
          <Button
            variant="solid"
            :label="__('Update')"
            :loading="settings.save.loading"
            :disabled="!isDirty"
            @click="update"
          />
        </template>
      </div>
    </template>

    <template #content>
      <div v-if="settings.doc" class="h-full">
        <div v-if="settings.doc.enabled" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <FormControl
              v-model="settings.doc.pbx_domain"
              :label="__('PBX Domain')"
              type="text"
              placeholder="pbx.example.com"
              required
              autocomplete="off"
            />

            <FormControl
              v-model="settings.doc.wss_url"
              :label="__('WebSocket URL')"
              type="text"
              placeholder="wss://pbx.example.com:8089/ws"
              required
              autocomplete="off"
            />
          </div>

          <FormControl
            v-model="settings.doc.stun_server"
            :label="__('STUN Server')"
            type="text"
            placeholder="stun:stun.example.com:3478"
            autocomplete="off"
          />

          <div class="grid grid-cols-3 gap-4">
            <FormControl
              v-model="settings.doc.country_code"
              :label="__('Country Code')"
              type="text"
              placeholder="27"
            />

            <FormControl
              v-model="settings.doc.national_prefix"
              :label="__('National Prefix')"
              type="text"
              placeholder="0"
            />

            <FormControl
              v-model="settings.doc.international_prefix"
              :label="__('International Prefix')"
              type="text"
              placeholder="00"
            />
          </div>

          <p class="text-sm text-ink-gray-5">
            {{
              __(
                'Configure the PBX WebSocket endpoint and dialling prefixes used by the browser calling integration.',
              )
            }}
          </p>
        </div>

        <div v-else class="relative flex h-full w-full justify-center">
          <div
            class="absolute left-1/2 flex w-72 -translate-x-1/2 flex-col items-center gap-3"
            :style="{ top: '35%' }"
          >
            <div class="flex flex-col items-center gap-1.5 text-center">
              <PhoneIcon class="size-7.5 text-ink-gray-7" />

              <span class="text-lg-medium text-ink-gray-8">
                {{ __('FreePBX Integration Disabled') }}
              </span>

              <span class="text-center text-p-base text-ink-gray-6">
                {{
                  __(
                    'Enable FreePBX integration to make and receive calls directly from your CRM.',
                  )
                }}
              </span>

              <Button
                :label="__('Enable')"
                variant="solid"
                @click="enable"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="settings.get.loading"
        class="flex items-center justify-center mt-[35%]"
      >
        <LoadingIndicator class="size-6" />
      </div>
    </template>
  </SettingsLayoutBase>
</template>

<script setup>
import { setEnabled } from '@/composables/telephony'
import { useDocument } from '@/data/document'
import { computed } from 'vue'

const emit = defineEmits(['updateStep'])

const { document: settings } = useDocument(
  'FreePBX Settings',
  'FreePBX Settings',
)

function enable() {
  settings.doc.enabled = true
}

function disable() {
  settings.doc.enabled = false
  update()
}

function update() {
  settings.save.submit(null, {
    onSuccess: () => {
      setEnabled('freepbx', settings.doc.enabled)
      settings.reload()
    },
  })
}

const isDirty = computed(() => {
  return (
    settings.doc &&
    settings.originalDoc &&
    JSON.stringify(settings.doc) !==
      JSON.stringify(settings.originalDoc)
  )
})
</script>
