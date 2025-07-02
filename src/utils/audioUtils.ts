export interface AudioSegment {
  blob: Blob
  startTime: number
  endTime: number
  duration: number
  index: number
}

export interface AudioSplitOptions {
  segmentDuration: number // セグメント長（秒）
  overlap: number // オーバーラップ（秒）
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null

  constructor() {
    // Web Audio APIの初期化は実際に使用する時に行う
    // サーバーサイドでは実行しない
    if (typeof window !== 'undefined') {
      // クライアントサイドでのみ初期化
    }
  }

  private async initAudioContext(): Promise<AudioContext> {
    if (typeof window === 'undefined') {
      throw new Error('Web Audio APIはブラウザ環境でのみ利用可能です')
    }

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
    
    return this.audioContext
  }

  async splitAudioFile(
    file: File,
    options: AudioSplitOptions = { segmentDuration: 60, overlap: 1 }
  ): Promise<AudioSegment[]> {
    try {
      // ブラウザ環境チェック
      if (typeof window === 'undefined') {
        throw new Error('音声処理はブラウザ環境でのみ実行可能です')
      }

      // Web Audio API対応チェック
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new Error('お使いのブラウザはWeb Audio APIをサポートしていません')
      }

      const audioContext = await this.initAudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      return this.splitAudioBuffer(audioBuffer, options)
    } catch (error) {
      console.error('Audio splitting failed:', error)
      
      // エラーの種類に応じたメッセージ
      if (error instanceof Error) {
        if (error.message.includes('Web Audio API')) {
          throw new Error('音声処理エラー: ' + error.message)
        } else if (error.message.includes('decodeAudioData')) {
          throw new Error('音声ファイルの形式がサポートされていません。MP3、WAV、M4A、OGG、FLAC形式をご利用ください。')
        } else {
          throw new Error('音声ファイルの分割に失敗しました: ' + error.message)
        }
      }
      
      throw new Error('音声ファイルの分割に失敗しました: 予期しないエラーが発生しました')
    }
  }

  private splitAudioBuffer(
    audioBuffer: AudioBuffer,
    options: AudioSplitOptions
  ): AudioSegment[] {
    const { segmentDuration, overlap } = options
    const sampleRate = audioBuffer.sampleRate
    const segmentSamples = Math.floor(segmentDuration * sampleRate)
    const overlapSamples = Math.floor(overlap * sampleRate)
    const stepSamples = segmentSamples - overlapSamples
    
    const segments: AudioSegment[] = []
    let currentPosition = 0
    let segmentIndex = 0

    while (currentPosition < audioBuffer.length) {
      const startSample = currentPosition
      const endSample = Math.min(currentPosition + segmentSamples, audioBuffer.length)
      const actualDuration = (endSample - startSample) / sampleRate
      
      // 短すぎるセグメントはスキップ
      if (actualDuration < 1) {
        break
      }

      const segmentBuffer = this.extractAudioSegment(
        audioBuffer, 
        startSample, 
        endSample
      )
      
      const blob = this.audioBufferToWav(segmentBuffer)
      
      segments.push({
        blob,
        startTime: startSample / sampleRate,
        endTime: endSample / sampleRate,
        duration: actualDuration,
        index: segmentIndex
      })

      currentPosition += stepSamples
      segmentIndex++
    }

    return segments
  }

  private extractAudioSegment(
    audioBuffer: AudioBuffer,
    startSample: number,
    endSample: number
  ): AudioBuffer {
    const audioContext = this.audioContext!
    const segmentLength = endSample - startSample
    const segmentBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      segmentLength,
      audioBuffer.sampleRate
    )

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel)
      const segmentChannelData = segmentBuffer.getChannelData(channel)
      
      for (let i = 0; i < segmentLength; i++) {
        segmentChannelData[i] = channelData[startSample + i]
      }
    }

    return segmentBuffer
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const bytesPerSample = 2
    const blockAlign = numberOfChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = length * blockAlign
    const bufferSize = 44 + dataSize
    
    const arrayBuffer = new ArrayBuffer(bufferSize)
    const view = new DataView(arrayBuffer)
    
    // WAVヘッダーの書き込み
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, bufferSize - 8, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bytesPerSample * 8, true)
    writeString(36, 'data')
    view.setUint32(40, dataSize, true)
    
    // 音声データの書き込み
    const channelData = []
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channelData.push(buffer.getChannelData(channel))
    }
    
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
        view.setInt16(offset, sample * 0x7FFF, true)
        offset += 2
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      audio.onloadedmetadata = () => {
        resolve(audio.duration)
      }
      audio.onerror = () => {
        reject(new Error('音声ファイルの読み込みに失敗しました'))
      }
      audio.src = URL.createObjectURL(file)
    })
  }

  cleanup() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}