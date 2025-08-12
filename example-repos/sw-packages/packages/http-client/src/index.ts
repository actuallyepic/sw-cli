import axios from 'axios'
import axiosRetry from 'axios-retry'
import { logger } from '@packages/logger'

const client = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

axiosRetry(client, { retries: 3 })

client.interceptors.request.use(request => {
  logger.info(`Making request to ${request.url}`)
  return request
})

export { client as httpClient }