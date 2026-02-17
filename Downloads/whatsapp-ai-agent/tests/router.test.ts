import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Inline the routing logic to test without needing config/DB imports
// This mirrors src/services/router.ts exactly

const CONFIDENCE_THRESHOLD = 0.75

type ContactMode = 'copilot' | 'auto' | 'human_only'

interface ContactStub {
  mode: ContactMode
  bot_paused: boolean
}

interface OutputStub {
  confidence: number
  handoff_recommended: boolean
  unsafe_or_out_of_scope: boolean
  reasons: string
}

type RoutingAction = 'auto_send' | 'slack_approval' | 'human_handoff' | 'ignore'

function routeDecision(
  contact: ContactStub,
  output: OutputStub
): { action: RoutingAction; reason: string } {
  if (contact.bot_paused) {
    return { action: 'ignore', reason: 'Bot paused for this contact' }
  }

  if (contact.mode === 'human_only') {
    return { action: 'human_handoff', reason: 'Contact is in human_only mode' }
  }

  if (output.unsafe_or_out_of_scope) {
    return { action: 'human_handoff', reason: `Unsafe/out-of-scope: ${output.reasons}` }
  }

  if (output.handoff_recommended) {
    return { action: 'human_handoff', reason: `LLM recommended handoff: ${output.reasons}` }
  }

  if (contact.mode === 'copilot') {
    return { action: 'slack_approval', reason: 'Copilot mode -- requires human approval' }
  }

  if (contact.mode === 'auto') {
    if (output.confidence >= CONFIDENCE_THRESHOLD) {
      return { action: 'auto_send', reason: `Auto mode, confidence ${output.confidence} >= ${CONFIDENCE_THRESHOLD}` }
    } else {
      return { action: 'slack_approval', reason: `Auto mode but low confidence ${output.confidence} < ${CONFIDENCE_THRESHOLD}` }
    }
  }

  return { action: 'slack_approval', reason: 'Unknown mode, defaulting to approval' }
}

// -- Helpers --

function makeContact(overrides: Partial<ContactStub> = {}): ContactStub {
  return { mode: 'copilot', bot_paused: false, ...overrides }
}

function makeOutput(overrides: Partial<OutputStub> = {}): OutputStub {
  return {
    confidence: 0.85,
    handoff_recommended: false,
    unsafe_or_out_of_scope: false,
    reasons: '',
    ...overrides,
  }
}

// -- Tests --

describe('routeDecision', () => {
  describe('paused contacts', () => {
    it('should ignore all messages when bot is paused', () => {
      const result = routeDecision(
        makeContact({ bot_paused: true, mode: 'auto' }),
        makeOutput({ confidence: 1.0 })
      )
      assert.equal(result.action, 'ignore')
    })

    it('should ignore even human_only when paused', () => {
      const result = routeDecision(
        makeContact({ bot_paused: true, mode: 'human_only' }),
        makeOutput()
      )
      assert.equal(result.action, 'ignore')
    })
  })

  describe('human_only mode', () => {
    it('should always hand off', () => {
      const result = routeDecision(
        makeContact({ mode: 'human_only' }),
        makeOutput({ confidence: 1.0 })
      )
      assert.equal(result.action, 'human_handoff')
    })
  })

  describe('unsafe content', () => {
    it('should hand off when unsafe regardless of mode', () => {
      for (const mode of ['copilot', 'auto'] as const) {
        const result = routeDecision(
          makeContact({ mode }),
          makeOutput({ unsafe_or_out_of_scope: true, reasons: 'test' })
        )
        assert.equal(result.action, 'human_handoff', `Failed for mode: ${mode}`)
      }
    })
  })

  describe('handoff recommended', () => {
    it('should hand off when LLM recommends it', () => {
      for (const mode of ['copilot', 'auto'] as const) {
        const result = routeDecision(
          makeContact({ mode }),
          makeOutput({ handoff_recommended: true, reasons: 'complex' })
        )
        assert.equal(result.action, 'human_handoff', `Failed for mode: ${mode}`)
      }
    })
  })

  describe('copilot mode', () => {
    it('should require Slack approval for any confidence', () => {
      const high = routeDecision(makeContact({ mode: 'copilot' }), makeOutput({ confidence: 0.99 }))
      const low = routeDecision(makeContact({ mode: 'copilot' }), makeOutput({ confidence: 0.1 }))

      assert.equal(high.action, 'slack_approval')
      assert.equal(low.action, 'slack_approval')
    })
  })

  describe('auto mode', () => {
    it('should auto send when confidence >= threshold', () => {
      const result = routeDecision(
        makeContact({ mode: 'auto' }),
        makeOutput({ confidence: 0.75 })
      )
      assert.equal(result.action, 'auto_send')
    })

    it('should auto send with high confidence', () => {
      const result = routeDecision(
        makeContact({ mode: 'auto' }),
        makeOutput({ confidence: 0.95 })
      )
      assert.equal(result.action, 'auto_send')
    })

    it('should require approval when confidence is below threshold', () => {
      const result = routeDecision(
        makeContact({ mode: 'auto' }),
        makeOutput({ confidence: 0.74 })
      )
      assert.equal(result.action, 'slack_approval')
    })

    it('should require approval when confidence is 0', () => {
      const result = routeDecision(
        makeContact({ mode: 'auto' }),
        makeOutput({ confidence: 0 })
      )
      assert.equal(result.action, 'slack_approval')
    })
  })

  describe('priority order', () => {
    it('should prioritize paused > unsafe', () => {
      const result = routeDecision(
        makeContact({ bot_paused: true }),
        makeOutput({ unsafe_or_out_of_scope: true })
      )
      assert.equal(result.action, 'ignore')
    })

    it('should prioritize human_only > high confidence auto', () => {
      const result = routeDecision(
        makeContact({ mode: 'human_only' }),
        makeOutput({ confidence: 1.0 })
      )
      assert.equal(result.action, 'human_handoff')
    })

    it('should prioritize unsafe > auto send', () => {
      const result = routeDecision(
        makeContact({ mode: 'auto' }),
        makeOutput({ confidence: 1.0, unsafe_or_out_of_scope: true })
      )
      assert.equal(result.action, 'human_handoff')
    })

    it('should prioritize handoff_recommended > copilot approval', () => {
      const result = routeDecision(
        makeContact({ mode: 'copilot' }),
        makeOutput({ handoff_recommended: true, reasons: 'sensitive' })
      )
      assert.equal(result.action, 'human_handoff')
    })
  })
})
