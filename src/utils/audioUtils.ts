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

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext
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
      const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('Web Audio APIがサポートされていません')
      }
      this.audioContext = new AudioContextClass()
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
      console.log('=== 音声分割開始 ===')
      console.log('ファイル情報:', {
        name: file.name,
        size: file.size,
        type: file.type
      })
      console.log('分割オプション:', options)

      // ブラウザ環境チェック
      if (typeof window === 'undefined') {
        throw new Error('音声処理はブラウザ環境でのみ実行可能です')
      }

      // Web Audio API対応チェック
      if (!window.AudioContext && !(window as WindowWithWebkitAudioContext).webkitAudioContext) {
        throw new Error('お使いのブラウザはWeb Audio APIをサポートしていません')
      }

      console.log('Web Audio API対応確認完了')

      const audioContext = await this.initAudioContext()
      console.log('AudioContext初期化完了:', audioContext.state)

      const arrayBuffer = await file.arrayBuffer()
      console.log('ファイル読み込み完了:', arrayBuffer.byteLength, 'bytes')

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      console.log('音声デコード完了:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      })
      
      const segments = this.splitAudioBuffer(audioBuffer, options)
      
      console.log('分割完了:', {
        segmentsCount: segments.length,
        segments: segments.map(s => ({
          index: s.index,
          duration: s.duration,
          blobSize: s.blob.size,
          startTime: s.startTime,
          endTime: s.endTime
        }))
      })

      // ファイルサイズチェック
      const maxSize = 20 * 1024 * 1024 // 20MB（Vercel制限の余裕を持って）
      const oversizedSegments = segments.filter(s => s.blob.size > maxSize)
      if (oversizedSegments.length > 0) {
        console.warn(`${oversizedSegments.length}個のセグメントが大きすぎます:`, 
          oversizedSegments.map(s => ({ index: s.index, size: s.blob.size })))
      }

      return segments
    } catch (error) {
      console.error('=== 音声分割エラー ===', error)
      
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
    
    // プランに応じて音声品質を調整（環境変数で判定）
    const isProPlan = process.env.NODE_ENV === 'production' // 簡易判定
    const bytesPerSample = isProPlan ? 2 : 1 // Pro: 16ビット, Hobby: 8ビット
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
    
    // 音声データの書き込み（プランに応じて品質調整）
    const channelData = []
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channelData.push(buffer.getChannelData(channel))
    }
    
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
        
        if (isProPlan) {
          // Proプラン: 16ビット品質
          view.setInt16(offset, sample * 0x7FFF, true)
          offset += 2
        } else {
          // Hobbyプラン: 8ビット品質（ファイルサイズ削減）
          const quantizedSample = Math.round(sample * 127)
          view.setInt8(offset, quantizedSample)
          offset += 1
        }
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