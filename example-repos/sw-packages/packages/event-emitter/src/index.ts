import { EventEmitter } from 'eventemitter3'

export class TypedEventEmitter<T extends Record<string, any>> {
  private emitter = new EventEmitter()

  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void {
    this.emitter.on(event as string, handler)
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    this.emitter.emit(event as string, payload)
  }

  off<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void {
    this.emitter.off(event as string, handler)
  }
}