<template>
  <div>
    <!-- Minimized pill -->
    <div
      v-show="showSmallCallPopup"
      class="ml-2 flex cursor-pointer select-none items-center justify-between gap-3 rounded-6 bg-surface-gray-10 px-2 py-[7px] text-base text-ink-gray-2"
      @click="toggleCallPopup"
    >
      <div class="flex items-center gap-2">
        <Avatar
          v-if="contact?.image"
          :image="contact.image"
          :label="contact.full_name"
          class="relative flex !h-5 !w-5 items-center justify-center"
        />
        <div
          v-else
          class="flex size-5 items-center justify-center rounded-full bg-surface-gray-9"
        >
          <AvatarIcon class="size-3" />
        </div>
        <div class="max-w-[120px] truncate">
          {{ contact?.full_name || displayNumber }}
        </div>
      </div>

      <div v-if="isConnected" class="flex items-center gap-2">
        <div class="my-1 min-w-[40px] text-center">
          {{ counterUp?.updatedTime }}
        </div>
        <Button
          variant="solid"
          theme="red"
          class="!h-6 !w-6 rounded-full rotate-[135deg] text-ink-base"
          :icon="PhoneIcon"
          @click.stop="endSession"
        />
      </div>
      <div v-else-if="isIncomingRinging" class="flex items-center gap-2">
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
      <div v-else-if="!isEnded" class="flex items-center gap-3">
        <div class="my-1">{{ statusText }}</div>
        <Button
          variant="solid"
          theme="red"
          class="!h-6 !w-6 rounded-full rotate-[135deg] text-ink-base"
          :icon="PhoneIcon"
          @click.stop="endSession"
        />
      </div>
      <div v-else class="blink text-red-700">{{ statusText }}</div>
    </div>

    <!-- Full popup -->
    <div
      v-show="showCallPopup"
      ref="callPopup"
      class="fixed z-20 flex select-none flex-col rounded-6 bg-surface-gray-10 p-4 text-ink-gray-2 shadow-2xl"
      :class="panelOpen ? 'w-[300px]' : 'w-60'"
      :style="style"
      @click.stop
    >
      <div ref="dragHandle" class="cursor-move">
        <div class="flex flex-row-reverse items-center gap-2">
          <MinimizeIcon
            class="h-4 w-4 cursor-pointer"
            @click="toggleCallPopup"
          />
          <Button
            v-if="isEnded"
            variant="solid"
            size="sm"
            icon="lucide-x"
            @click="closeCallPopup"
          />
        </div>

        <div class="flex flex-col items-center justify-center gap-3">
          <Avatar
            v-if="contact?.image"
            :image="contact.image"
            :label="contact.full_name"
            class="relative flex !h-24 !w-24 items-center justify-center [&>div]:text-[30px]"
            :class="isIncomingRinging ? 'pulse' : ''"
          />
          <div
            v-else
            class="relative flex h-24 w-24 items-center justify-center rounded-full bg-surface-gray-9"
            :class="isIncomingRinging ? 'pulse' : ''"
          >
            <AvatarIcon class="size-10" />
          </div>

          <div class="flex flex-col items-center justify-center gap-1">
            <div class="text-2xl-medium">
              {{ contact?.full_name || __('Unknown') }}
            </div>
            <div class="text-sm text-ink-gray-5">{{ displayNumber }}</div>
          </div>

          <div v-if="isConnected" class="my-1 text-base">
            {{ counterUp?.updatedTime }}
          </div>
          <div
            v-else
            class="my-1 text-base"
            :class="isEnded ? 'blink text-red-700' : ''"
          >
            {{ statusText }}
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="mt-2 flex items-center justify-center gap-2">
        <!-- incoming, not answered yet -->
        <template v-if="isIncomingRinging">
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
        </template>

        <!-- connected (and after a connected call ends): inline circles -->
        <template v-else-if="showTools">
          <Button
            v-if="isConnected"
            :icon="muted ? 'lucide-mic-off' : 'lucide-mic'"
            class="rounded-full"
            :tooltip="muted ? __('Unmute') : __('Mute')"
            @click="toggleMute"
          />
          <Button
            class="cursor-pointer rounded-full"
            :tooltip="__('Add a Note')"
            :icon="NoteIcon"
            @click="toggleNotePanel"
          />
          <Button
            class="cursor-pointer rounded-full"
            :tooltip="__('Add a Task')"
            :icon="TaskIcon"
            @click="toggleTaskPanel"
          />
          <Button
            v-if="isConnected"
            class="rounded-full bg-surface-red-7 hover:bg-surface-red-8 rotate-[135deg] text-ink-base"
            :tooltip="__('Hang Up')"
            :icon="PhoneIcon"
            @click="endSession"
          />
        </template>

        <!-- dialling / ringing / connecting -->
        <Button
          v-else-if="!isEnded"
          size="md"
          variant="solid"
          theme="red"
          :label="__('Cancel')"
          class="rounded-6 text-ink-base"
          @click="endSession"
        >
          <template #prefix>
            <PhoneIcon class="rotate-[135deg]" />
          </template>
        </Button>
      </div>

      <!-- Note / Task panel -->
      <div v-if="showTools && panelOpen" class="mt-3 flex flex-col gap-3">
        <RichTextField
          v-if="showNote"
          editor-class="prose-sm h-[160px] text-ink-base overflow-auto"
          :content="note.content"
          :placeholder="__('Take a note...')"
          @change="(val) => (note.content = val)"
        />
        <TaskPanel v-else ref="taskRef" :task="task" />

        <div class="flex items-center justify-between gap-2">
          <Button
            v-if="contact?.deal || contact?.lead"
            :iconRight="ArrowUpRightIcon"
            :label="contact.deal ? __('Deal') : __('Lead')"
            @click="openDealOrLead"
          />
          <span v-else />
          <Button
            variant="solid"
            :label="panelHasName ? __('Update') : __('Save')"
            :loading="saving"
            :disabled="!canSave"
            @click="savePanel"
          />
        </div>
      </div>
    </div>

    <CountUpTimer ref="counterUp" />
  </div>
</template>

<script setup>
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import AvatarIcon from '@/components/Icons/AvatarIcon.vue'
import MinimizeIcon from '@/components/Icons/MinimizeIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import TaskPanel from '@/components/Telephony/TaskPanel.vue'
import CountUpTimer from '@/components/CountUpTimer.vue'
import RichTextField from '@/components/RichTextField.vue'
import { useTelemetry } from '@framework/ui/telemetry'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { Avatar, Button, call, createResource, toast } from 'frappe-ui'
import {
  Inviter,
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
} from 'sip.js'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

/*
 * FreePBX / Asterisk softphone for Frappe CRM.
 * Same popup as TwilioCallUI; the call leg is a SIP.js session
 * registered to FreePBX over WSS (server side: freepbx.api.*).
 */

const { capture } = useTelemetry()
const router = useRouter()

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
let answered = false
let endedByUs = false
let failureCode = null
let autoCloseTimer = null
let lastLog = { number: '', direction: '' }
let logPromise = Promise.resolve(null) // resolves to the CRM Call Log name

/* ------------------------------------------------------------------ */
/* UI state                                                            */
/* ------------------------------------------------------------------ */

const callPopup = ref(null)
const dragHandle = ref(null)
const counterUp = ref(null)
const showCallPopup = ref(false)
const showSmallCallPopup = ref(false)

// 'Calling...' | 'Ringing...' | 'Incoming call...' | 'Connecting...' |
// 'In progress' | 'Call ended' | 'No answer' | 'Busy' | 'Failed' | 'Canceled'
const callStatus = ref('')
const callDuration = ref('00:00')
const wasConnected = ref(false)
const muted = ref(false)
const phoneNumber = ref('')

const ENDED = ['Call ended', 'No answer', 'Busy', 'Failed', 'Canceled']
const isEnded = computed(() => ENDED.includes(callStatus.value))
const isConnected = computed(() => callStatus.value === 'In progress')
const isIncomingRinging = computed(
  () => callStatus.value === 'Incoming call...',
)
// note / task / mute / hang up only exist once the call has connected
const showTools = computed(
  () => isConnected.value || (isEnded.value && wasConnected.value),
)

const statusText = computed(() =>
  callStatus.value === 'Call ended'
    ? `${__('Call ended')} · ${callDuration.value}`
    : __(callStatus.value),
)

const contact = ref({ full_name: '', image: '', mobile_no: '' })
const displayNumber = computed(
  () => contact.value?.mobile_no || phoneNumber.value,
)

const getContact = createResource({
  url: 'crm.integrations.api.get_contact_by_phone_number',
  makeParams() {
    return { phone_number: phoneNumber.value }
  },
  onSuccess(data) {
    if (data) {
      contact.value = {
        ...data,
        mobile_no: data.mobile_no || phoneNumber.value,
      }
    }
  },
})

function setPhone(number) {
  phoneNumber.value = number
  // show the number straight away, then enrich with the CRM contact
  contact.value = { full_name: '', image: '', mobile_no: number }
  if (number) getContact.fetch()
}

const { width, height } = useWindowSize()

const { style, y } = useDraggable(callPopup, {
  handle: dragHandle,
  initialValue: { x: width.value - 280, y: height.value - 380 },
  preventDefault: true,
})

function toggleCallPopup() {
  showCallPopup.value = !showCallPopup.value
  showSmallCallPopup.value = !showSmallCallPopup.value
}

function openPopup() {
  showCallPopup.value = true
  showSmallCallPopup.value = false
}

/* ------------------------------------------------------------------ */
/* Notes & tasks                                                       */
/* ------------------------------------------------------------------ */

const showNote = ref(false)
const showTask = ref(false)
const saving = ref(false)
const panelOpen = computed(() => showNote.value || showTask.value)

const emptyNote = () => ({ name: '', title: '', content: '' })
const emptyTask = () => ({
  name: '',
  title: '',
  description: '',
  assigned_to: '',
  due_date: '',
  status: 'Backlog',
  priority: 'Low',
})
const note = ref(emptyNote())
const task = ref(emptyTask())

const hasNoteContent = computed(() => {
  const c = note.value.content
  return !!c && c !== '<p></p>' && !!stripHtml(c)
})
const canSave = computed(() =>
  showNote.value ? hasNoteContent.value : !!task.value.title,
)
const panelHasName = computed(() =>
  showNote.value ? !!note.value.name : !!task.value.name,
)

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// keep the popup on screen when the panel opens / closes
watch(panelOpen, (open) => {
  if (open) y.value = Math.max(10, y.value - 200)
  else y.value = Math.max(10, Math.min(y.value + 200, height.value - 340))
})

function toggleNotePanel() {
  showNote.value = !showNote.value
  if (showNote.value) showTask.value = false
}

function toggleTaskPanel() {
  showTask.value = !showTask.value
  if (showTask.value) showNote.value = false
}

async function ensureCallLog() {
  let name = await logPromise
  if (!name) {
    // the log was never created (e.g. a network hiccup): try once more
    startLog(lastLog.number, lastLog.direction)
    name = await logPromise
  }
  if (!name) throw new Error(__('The call log could not be created'))
  return name
}

function showError(err) {
  console.error('FreePBX: save failed', err)
  toast.error(err?.messages?.[0] || err?.message || __('Could not save'))
}

async function saveNote() {
  const callLogName = await ensureCallLog()
  const title = note.value.title || stripHtml(note.value.content).slice(0, 60)
  const _note = await call('crm.integrations.api.add_note_to_call_log', {
    call_sid: callLogName,
    note: { ...note.value, title: title || 'Note' },
  })
  const isNew = !note.value.name
  note.value = {
    ...note.value,
    title: title || 'Note',
    name: _note?.name || note.value.name,
  }
  capture(isNew ? 'note_created' : 'note_updated')
  toast.success(isNew ? __('Note saved') : __('Note updated'))
}

async function saveTask() {
  const callLogName = await ensureCallLog()
  const _task = await call('crm.integrations.api.add_task_to_call_log', {
    call_sid: callLogName,
    task: task.value,
  })
  const isNew = !task.value.name
  task.value = { ...task.value, name: _task?.name || task.value.name }
  toast.success(isNew ? __('Task saved') : __('Task updated'))
}

async function savePanel() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    if (showNote.value) await saveNote()
    else await saveTask()
  } catch (err) {
    showError(err)
  } finally {
    saving.value = false
  }
}

function openDealOrLead() {
  if (contact.value.deal) {
    router.push({ name: 'Deal', params: { dealId: contact.value.deal } })
  } else if (contact.value.lead) {
    router.push({ name: 'Lead', params: { leadId: contact.value.lead } })
  }
}

function closeCallPopup() {
  clearTimeout(autoCloseTimer)
  showCallPopup.value = false
  showSmallCallPopup.value = false
  showNote.value = false
  showTask.value = false
  callStatus.value = ''
  callDuration.value = '00:00'
  wasConnected.value = false
  note.value = emptyNote()
  task.value = emptyTask()
}

/* ------------------------------------------------------------------ */
/* Call log (server side: freepbx.api)                                 */
/* ------------------------------------------------------------------ */

function startLog(number, direction) {
  lastLog = { number, direction }
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
  clearTimeout(autoCloseTimer)
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

// -> [status shown in the popup, status stored on the CRM Call Log]
function outcome(direction) {
  if (answered) return ['Call ended', 'Completed']
  if (endedByUs) return ['Canceled', 'Canceled']
  if (direction === 'Incoming') return ['No answer', 'No Answer']
  if (failureCode === 486 || failureCode === 600) return ['Busy', 'Busy']
  if ([408, 480, 487].includes(failureCode)) return ['No answer', 'No Answer']
  return ['Failed', 'Failed']
}

function finishCall(uiStatus, logStatus) {
  if (uiStatus === 'Call ended') {
    callDuration.value = counterUp.value?.updatedTime || '00:00'
  }
  counterUp.value?.stop()
  callStatus.value = uiStatus
  muted.value = false
  if (remoteAudio) remoteAudio.srcObject = null
  updateLog(logStatus)
  log.value = `Call ended (${uiStatus}).`
  session = null

  // calls that never connected have nothing to annotate: close by themselves
  if (!wasConnected.value) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = setTimeout(() => {
      if (isEnded.value && !wasConnected.value) closeCallPopup()
    }, 4000)
  }
}

function trackSession(s, direction) {
  s.stateChange.addListener((state) => {
    if (s !== session) return

    if (state === SessionState.Established) {
      answered = true
      wasConnected.value = true
      callStatus.value = 'In progress'
      attachRemoteAudio(s)
      counterUp.value?.start()
      updateLog('In Progress')
      log.value = 'Call in progress.'
    }

    if (state === SessionState.Terminated) {
      const [uiStatus, logStatus] = outcome(direction)
      finishCall(uiStatus, logStatus)
    }
  })
}

function resetForNewCall() {
  closeCallPopup()
  answered = false
  endedByUs = false
  failureCode = null
  muted.value = false
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

  resetForNewCall()
  session = invitation
  setPhone(from)
  callStatus.value = 'Incoming call...'
  openPopup()

  startLog(from, 'Incoming')
  trackSession(invitation, 'Incoming')
}

async function acceptIncomingCall() {
  if (!session) return
  log.value = 'Accepted incoming call.'
  callStatus.value = 'Connecting...'
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

  log.value = `Attempting to call ${number} ...`

  resetForNewCall()
  setPhone(number)

  const inviter = new Inviter(
    ua,
    UserAgent.makeURI(`sip:${dial}@${config.domain}`),
    sessionOptions(),
  )
  session = inviter

  callStatus.value = 'Calling...'
  openPopup()

  capture('make_outgoing_call')
  startLog(number, 'Outgoing')
  trackSession(inviter, 'Outgoing')

  try {
    await inviter.invite({
      requestDelegate: {
        onProgress: (response) => {
          const code = response.message.statusCode
          if (code === 180 || code === 183) {
            callStatus.value = 'Ringing...'
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
    if (session === inviter) finishCall('Failed', 'Failed')
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

// Hang up / cancel, depending on the session state
function endSession() {
  if (!session) return
  endedByUs = true
  log.value = 'Ending call'
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
    finishCall('Canceled', 'Canceled')
  }
}

watch(
  () => log.value,
  (value) => console.log(value),
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

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.blink {
  animation: blink 1s ease-in-out 6;
}

:deep(.ProseMirror) {
  caret-color: var(--ink-base);
}
</style>