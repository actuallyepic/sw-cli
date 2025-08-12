import { AnalyticsBrowser } from '@segment/analytics-next'
import * as amplitude from '@amplitude/analytics-browser'
import { logger } from '@packages/logger'
import { httpClient } from '@packages/http-client'
import { TypedEventEmitter } from '@packages/event-emitter'

interface AnalyticsEvents {
  track: { event: string; properties?: Record<string, any> }
  identify: { userId: string; traits?: Record<string, any> }
}

export class AnalyticsService {
  private segment?: AnalyticsBrowser
  private events = new TypedEventEmitter<AnalyticsEvents>()

  async initialize() {
    logger.info('Initializing analytics service')
    
    if (process.env.SEGMENT_WRITE_KEY) {
      const [analytics] = await AnalyticsBrowser.load({
        writeKey: process.env.SEGMENT_WRITE_KEY
      })
      this.segment = analytics
    }

    if (process.env.AMPLITUDE_API_KEY) {
      amplitude.init(process.env.AMPLITUDE_API_KEY)
    }
  }

  track(event: string, properties?: Record<string, any>) {
    this.events.emit('track', { event, properties })
    this.segment?.track(event, properties)
    amplitude.track(event, properties)
  }
}

// This package depends on @packages/http-client, @packages/logger, and @packages/event-emitter