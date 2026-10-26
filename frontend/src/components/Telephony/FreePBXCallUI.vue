<template>
  <div v-show="showCallPopup" v-bind="$attrs">
    <div
      ref="callPopup"
      class="fixed z-20 flex w-60 cursor-move select-none flex-col rounded-6 bg-surface-gray-10 p-4 text-ink-gray-2 shadow-2xl"
      :style="style"
    >
      <div class="flex flex-row-reverse items-center gap-1">
        <MinimizeIcon
          class="h-4 w-4 cursor-pointer"
          @click="toggleCallWindow"
        />
      </div>
      <div class="flex flex-col items-center justify-center gap-3">
        <Avatar
          v-if="contact?.image"
          :image="contact.image"
          :label="contact.full_name"
          class="relative flex !h-24 !w-24 items-center justify-center [&>div]:text-[30px]"
          :class="onCall || calling ? '' : 'pulse'"
        />
        <div class="flex flex-col items-center justify-center gap-1">
          <div class="text-2xl-medium">
            {{ contact?.full_name ?? __('Unknown') }}
          </div>
          <div class="text-sm text-ink-gray-5">{{ contact?.mobile_no }}</div>
        </div>
        <CountUpTimer ref="counterUp">
          <div v-if="onCall" class="my-1 text-base">
            {{ counterUp?.updatedTime }}
          </div>
        </CountUpTimer>
        <div v-if="!onCall" class="my-1 text-base">
          {{
            callStatus == 'initiating'
              ? __('Initiating call...')
              : callStatus == 'ringing'
                ? __('Ringing...')
                : calling
                  ? __('Calling...')
                  : __('Incoming call...')
          }}
        </div>
        <div v-if="onCall" class="flex gap-2">
          <Button
            :icon="muted ? 'lucide-mic-off' : 'lucide-mic'"
            class="rounded-full"
            @click="toggleMute"
          />
          <!-- <Button class="rounded-full">
          <template #icon>
            <DialpadIcon class="cursor-pointer rounded-full" />
          </template>
        </Button> -->
          <Button
            class="cursor-pointer rounded-full"
            :tooltip="__('Add a Note')"
            :icon="NoteIcon"
            @click="openNoteModal"
          />
          <Button
            class="rounded-full bg-surface-red-7 hover:bg-surface-red-8 rotate-[135deg] text-ink-base"
            :tooltip="__('Hang Up')"
            :icon="PhoneIcon"
            @click="hangUpCall"
          />
        </div>
        <div v-else-if="calling || callStatus == 'initiating'">
          <Button
            size="md"
            variant="solid"
            theme="red"
            :label="__('Cancel')"
            class="rounded-6 text-ink-base"
            :disabled="callStatus == 'initiating'"
            @click="cancelCall"
          >
            <template #prefix>
              <PhoneIcon class="rotate-[135deg]" />
            </template>
          </Button>
        </div>
        <div v-else class="flex gap-2">
          <Button
            size="md"
            variant="solid"
            theme="green"
            :label="__('Accept')"
            class="rounded-6 text-ink-base"
            :iconLeft="PhoneIcon"
            @click="acceptIncomingCall"
          />
          <Button
            size="md"
            variant="solid"
            theme="red"
            :label="__('Reject')"
            class="rounded-6 text-ink-base"
            @click="rejectIncomingCall"
          >
            <template #prefix>
              <PhoneIcon class="rotate-[135deg]" />
            </template>
          </Button>
        </div>
      </div>
    </div>
  </div>
  <div
    v-show="showSmallCallWindow"
    class="ml-2 flex cursor-pointer select-none items-center justify-between gap-3 rounded-6 bg-surface-gray-10 px-2 py-[7px] text-base text-ink-gray-2"
    v-bind="$attrs"
    @click="toggleCallWindow"
  >
    <div class="flex items-center gap-2">
      <Avatar
        v-if="contact?.image"
        :image="contact.image"
        :label="contact.full_name"
        class="relative flex !h-5 !w-5 items-center justify-center"
      />
      <div class="max-w-[120px] truncate">
        {{ contact?.full_name ?? __('Unknown') }}
      </div>
    </div>
    <div v-if="onCall" class="flex items-center gap-2">
      <div class="my-1 min-w-[40px] text-center">
        {{ counterUp?.updatedTime }}
      </div>
      <Button
        variant="solid"
        theme="red"
        class="!h-6 !w-6 rounded-full rotate-[135deg] text-ink-base"
        :icon="PhoneIcon"
        @click.stop="hangUpCall"
      />
    </div>
    <div v-else-if="calling" class="flex items-center gap-3">
      <div class="my-1">
        {{ callStatus == 'ringing' ? __('Ringing...') : __('Calling...') }}
      </div>
      <Button
        variant="solid"
        theme="red"
        class="!h-6 !w-6 rounded-full rotate-[135deg] text-ink-base"
        :icon="PhoneIcon"
        @click.stop="cancelCall"
      />
    </div>
    <div v-else class="flex items-center gap-2">
      <Button
        variant="solid"
        theme="green"
        class="pulse relative !h-6 !w-6 rounded-full animate-pulse text-ink-base"
        :tooltip="__('Accept Call')"
        :icon="PhoneIcon"
        @click.stop="acceptIncomingCall"
      />
      <Button
        variant="solid"
        theme="red"
        class="!h-6 !w-6 rounded-full rotate-[135deg] text-ink-base"
        :tooltip="__('Reject Call')"
        :icon="PhoneIcon"
        @click.stop="rejectIncomingCall"
      />
    </div>
  </div>
</template>

<script setup>
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import MinimizeIcon from '@/components/Icons/MinimizeIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import CountUpTimer from '@/components/CountUpTimer.vue'
import { useDoctypeModal } from '@/composables/doctypeModal'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useTelemetry } from '@framework/ui/telemetry'
import { Avatar, call, createResource, toast } from 'frappe-ui'
import {
  Inviter,
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
} from 'sip.js'
import { onBeforeUnmount, ref, watch } from 'vue'

/*
 * FreePBX / Asterisk softphone for Frappe CRM.
 *
 * Mirrors TwilioCallUI.vue: same popup, same exposed interface
 * ({ setup, makeOutgoingCall }), but the call leg is a SIP.js session
 * registered to FreePBX over WSS. Server side lives in the `freepbx` app
 * (freepbx.api.*).
 */

const { capture } = useTelemetry()

let log = ref('Connecting...')

// SIP state (kept outside of Vue reactivity on purpose)
let ua = null
let registerer = null
let session = null // active Inviter (outgoing) or Invitation (incoming)
let config = null
let remoteAudio = null
let reconnectTimer = null
let reconnectAttempts = 0
let stopping = false
let answered = false // the call reached the "Established" state
let endedByUs = false // the agent cancelled, rejected or hung up
let failureCode = null // SIP status code when the far end rejected an outgoing call
let logPromise = Promise.resolve(null) // resolves to the CRM Call Log name

let showCallPopup = ref(false)
let showSmallCallWindow = ref(false)
let onCall = ref(false)
let calling = ref(false)
let muted = ref(false)
let callPopup = ref(null)
let counterUp = ref(null)
let callStatus = ref('')

const phoneNumber = ref('')

const contact = ref({
  full_name: '',
  image: '',
  mobile_no: '',
})

watch(phoneNumber, (value) => {
  if (!value) return
  getContact.fetch()
})

const getContact = createResource({
  url: 'crm.integrations.api.get_contact_by_phone_number',
  makeParams() {
    return {
      phone_number: phoneNumber.value,
    }
  },
  cache: ['contact', phoneNumber.value],
  onSuccess(data) {
    contact.value = data
  },
})

const { showModal } = useDoctypeModal()
const note = ref({
  name: '',
  title: '',
  content: '',
})

function openNoteModal() {
  showModal({
    name: note.value.name || null,
    doctype: 'CRM Call Log',
    title: 'Call Log',
    callbacks: {
      afterInsert: (n) => updateNote(n, true),
      afterUpdate: updateNote,
    },
  })
}

async function updateNote(_note, isInsert = false) {
  note.value = _note
  if (isInsert && _note.name) {
    const callLogName = await logPromise
    if (callLogName) {
      await call('crm.integrations.api.add_note_to_call_log', {
        call_sid: callLogName,
        note: _note,
      })
    }
    capture('note_created')
  } else {
    capture('note_updated')
  }
}

const { width, height } = useWindowSize()

let { style } = useDraggable(callPopup, {
  initialValue: { x: width.value - 280, y: height.value - 310 },
  preventDefault: true,
})

/* ------------------------------------------------------------------ */
/* Call log (server side: freepbx.api)                                 */
/* ------------------------------------------------------------------ */

function startLog(number, direction) {
  logPromise = call('freepbx.api.create_call_log', { number, direction })
    .then((name) => name || null)
    .catch((err) => {
      log.value = 'Could not create call log: ' + err.message
      return null
    })
}

// Updates are chained so they reach the server in order.
function updateLog(status) {
  logPromise = logPromise.then(async (name) => {
    if (name) {
      try {
        await call('freepbx.api.update_call_log', { call_id: name, status })
      } catch (err) {
        console.error('FreePBX: call log update failed', err)
      }
    }
    return name
  })
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

async function setup() {
  // Only one registration per browser tab / extension.
  if (ua || window.__freepbxActive) return

  try {
    config = await call('freepbx.api.get_sip_config')
  } catch (err) {
    log.value = 'FreePBX is not available: ' + err.message
    return
  }

  if (!config?.configured) {
    log.value = 'No FreePBX extension is set for this user.'
    return
  }

  window.__freepbxActive = true
  stopping = false
  remoteAudio = new Audio()
  remoteAudio.autoplay = true

  ua = new UserAgent({
    uri: UserAgent.makeURI(`sip:${config.extension}@${config.domain}`),
    displayName: config.display_name || config.extension,
    authorizationUsername: config.extension,
    authorizationPassword: config.password,
    transportOptions: { server: config.wss_url },
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: {
        iceServers: config.stun ? [{ urls: config.stun }] : [],
      },
      iceGatheringTimeout: 1000,
    },
    logLevel: 'warn',
    delegate: {
      onInvite: handleIncomingCall,
      onConnect: () => {
        reconnectAttempts = 0
        // After a dropped connection the registration has to be renewed.
        registerer?.register().catch(() => {})
      },
      onDisconnect: (error) => {
        log.value = 'Disconnected from FreePBX'
        if (!stopping && error) scheduleReconnect()
      },
    },
  })

  try {
    await ua.start()
    registerer = new Registerer(ua, { expires: 120 })
    registerer.stateChange.addListener((state) => {
      if (state === RegistererState.Registered) {
        log.value = 'Ready to make and receive calls!'
      } else if (state === RegistererState.Unregistered) {
        log.value = 'Logged out'
      }
    })
    await registerer.register()
  } catch (err) {
    log.value = 'FreePBX registration failed: ' + err.message
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (stopping || !ua) return
  clearTimeout(reconnectTimer)
  const delay = Math.min(30000, 2000 * 2 ** reconnectAttempts++)
  reconnectTimer = setTimeout(async () => {
    try {
      await ua.reconnect()
    } catch {
      scheduleReconnect()
    }
  }, delay)
}

async function shutdown() {
  stopping = true
  clearTimeout(reconnectTimer)
  try {
    if (registerer) await registerer.unregister()
  } catch {
    /* ignore */
  }
  try {
    if (ua) await ua.stop()
  } catch {
    /* ignore */
  }
  ua = null
  registerer = null
  window.__freepbxActive = false
}

onBeforeUnmount(shutdown)

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// +27821234567 -> 0821234567, +4420... -> 004420... (rules come from FreePBX Settings)
function toDialString(number) {
  let n = String(number || '').replace(/[\s\-().]/g, '')
  if (n.startsWith('+')) {
    n = n.slice(1)
    const cc = config.country_code
    if (cc && n.startsWith(cc)) return config.national_prefix + n.slice(cc.length)
    return config.international_prefix + n
  }
  return n
}

function sessionOptions() {
  return {
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
    },
  }
}

function attachRemoteAudio(s) {
  const pc = s.sessionDescriptionHandler?.peerConnection
  if (!pc || !remoteAudio) return
  const stream = new MediaStream()
  pc.getReceivers().forEach((r) => r.track && stream.addTrack(r.track))
  remoteAudio.srcObject = stream
  remoteAudio.play().catch(() => {})
}

function statusFromFailure(code) {
  if (code === 486 || code === 600) return 'Busy'
  if (code === 408 || code === 480 || code === 487) return 'No Answer'
  return 'Failed'
}

function resetCallUI() {
  showCallPopup.value = false
  showSmallCallWindow.value = false
  calling.value = false
  onCall.value = false
  callStatus.value = ''
  muted.value = false
  note.value = { name: '', title: '', content: '' }
  counterUp.value?.stop()
  if (remoteAudio) remoteAudio.srcObject = null
}

function trackSession(s, direction) {
  s.stateChange.addListener((state) => {
    if (s !== session) return

    if (state === SessionState.Established) {
      answered = true
      calling.value = false
      onCall.value = true
      callStatus.value = ''
      attachRemoteAudio(s)
      counterUp.value?.start()
      updateLog('In Progress')
      log.value = 'Call in progress.'
    }

    if (state === SessionState.Terminated) {
      let status = 'Completed'
      if (!answered) {
        if (direction === 'Incoming') {
          status = endedByUs ? 'Canceled' : 'No Answer'
        } else {
          status = endedByUs ? 'Canceled' : statusFromFailure(failureCode)
        }
      }
      updateLog(status)
      log.value = `Call ended (${status}).`
      session = null
      resetCallUI()
    }
  })
}

/* ------------------------------------------------------------------ */
/* Incoming calls                                                      */
/* ------------------------------------------------------------------ */

function handleIncomingCall(invitation) {
  // One call at a time: answer busy to anything else.
  if (session) {
    invitation.reject({ statusCode: 486 }).catch(() => {})
    return
  }

  const from = invitation.remoteIdentity?.uri?.user || ''
  log.value = `Incoming call from ${from}`
  session = invitation
  answered = false
  endedByUs = false
  failureCode = null

  phoneNumber.value = from
  calling.value = false
  onCall.value = false
  callStatus.value = ''
  showCallPopup.value = true

  startLog(from, 'Incoming')
  trackSession(invitation, 'Incoming')
}

async function acceptIncomingCall() {
  if (!session) return
  log.value = 'Accepted incoming call.'
  onCall.value = true
  try {
    await session.accept(sessionOptions())
  } catch (err) {
    toast.error(__('Could not answer the call: {0}', [err.message]))
  }
}

function rejectIncomingCall() {
  if (!session) return
  endedByUs = true
  log.value = 'Rejected incoming call'
  session.reject({ statusCode: 603 }).catch(() => {})
}

/* ------------------------------------------------------------------ */
/* Outgoing calls                                                      */
/* ------------------------------------------------------------------ */

async function makeOutgoingCall(number) {
  if (!ua || !registerer || registerer.state !== RegistererState.Registered) {
    toast.error(__('FreePBX is not connected. Check your extension settings.'))
    return
  }
  if (session) {
    toast.warning(__('You are already on a call'))
    return
  }

  const dial = toDialString(number)
  if (!/^[0-9*#]+$/.test(dial)) {
    toast.error(__('Invalid phone number: {0}', [number]))
    return
  }

  phoneNumber.value = number
  log.value = `Attempting to call ${number} ...`

  const inviter = new Inviter(
    ua,
    UserAgent.makeURI(`sip:${dial}@${config.domain}`),
    sessionOptions(),
  )
  session = inviter
  answered = false
  endedByUs = false
  failureCode = null

  showCallPopup.value = true
  calling.value = true
  callStatus.value = ''

  capture('make_outgoing_call')
  startLog(number, 'Outgoing')
  trackSession(inviter, 'Outgoing')

  try {
    await inviter.invite({
      requestDelegate: {
        onProgress: (response) => {
          const code = response.message.statusCode
          if (code === 180 || code === 183) {
            callStatus.value = 'ringing'
            updateLog('Ringing')
          }
        },
        onReject: (response) => {
          failureCode = response.message.statusCode
        },
      },
    })
  } catch (error) {
    log.value = `Could not connect call: ${error.message}`
    toast.error(__('Could not start the call: {0}', [error.message]))
    if (session === inviter) {
      updateLog('Failed')
      session = null
      resetCallUI()
    }
  }
}

/* ------------------------------------------------------------------ */
/* In-call controls                                                    */
/* ------------------------------------------------------------------ */

function toggleMute() {
  const pc = session?.sessionDescriptionHandler?.peerConnection
  if (!pc) return
  muted.value = !muted.value
  pc.getSenders().forEach((sender) => {
    if (sender.track) sender.track.enabled = !muted.value
  })
}

function endSession() {
  if (!session) return
  endedByUs = true
  try {
    if (session.state === SessionState.Established) {
      session.bye().catch(() => {})
    } else if (session instanceof Inviter) {
      session.cancel().catch(() => {})
    } else {
      session.reject({ statusCode: 603 }).catch(() => {})
    }
  } catch (err) {
    console.error('FreePBX: could not end session', err)
    session = null
    resetCallUI()
  }
}

function hangUpCall() {
  log.value = 'Hanging up'
  endSession()
}

function cancelCall() {
  log.value = 'Cancelling call'
  endSession()
}

function toggleCallWindow() {
  showCallPopup.value = !showCallPopup.value
  showSmallCallWindow.value = !showSmallCallWindow.value
}

watch(
  () => log.value,
  (value) => {
    console.log(value)
  },
  { immediate: true },
)

defineExpose({ makeOutgoingCall, setup })
</script>

<style scoped>
.pulse::before {
  content: '';
  position: absolute;
  border: 1px solid green;
  width: calc(100% + 20px);
  height: calc(100% + 20px);
  border-radius: 50%;
  animation: pulse 1s linear infinite;
}

.pulse::after {
  content: '';
  position: absolute;
  border: 1px solid green;
  width: calc(100% + 20px);
  height: calc(100% + 20px);
  border-radius: 50%;
  animation: pulse 1s linear infinite;
  animation-delay: 0.3s;
}

@keyframes pulse {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }

  50% {
    transform: scale(1);
    opacity: 1;
  }

  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}
</style>