export interface TranscriptionSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens: number[]
  temperature: number
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
}

export interface TranscriptionWord {
  word: string
  start: number
  end: number
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  words: TranscriptionWord[]
  language: string
  duration: number
}

export interface TranscriptionOptions {
  language?: string
  model?: string
}

export class GroqAPIClient {
  private readonly baseUrl: string

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
  }

  async transcribeAudio(
    audioBlob: Blob,
    options: TranscriptionOptions = {},
    retryCount: number = 0
  ): Promise<TranscriptionResult> {
    const maxRetries = 3
    const baseDelay = 1000 // 1秒

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.wav')
      
      if (options.language) {
        formData.append('language', options.language)
      }
      
      if (options.model) {
        formData.append('model', options.model)
      }

      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
      })
      console.log('API Response:', response)

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        
        // レート制限エラーの場合、指数バックオフでリトライ
        if (response.status === 429 && retryCount < maxRetries) {
          // エラーメッセージから待機時間を抽出
          let waitTime = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000
          
          // エラーメッセージに待機時間が含まれている場合、それを優先
          const waitTimeMatch = errorMessage.match(/try again in ([\d.]+)s/)
          if (waitTimeMatch) {
            const extractedWaitTime = parseFloat(waitTimeMatch[1]) * 1000
            waitTime = Math.max(waitTime, extractedWaitTime + 500) // 余裕を持って待機
          }
          
          console.log(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          return this.transcribeAudio(audioBlob, options, retryCount + 1)
        }
        
        // APIキーエラーの場合、リトライしない
        if (response.status === 401) {
          throw new Error('APIキーが無効です。正しいAPIキーを設定してください。')
        }
        
        throw new Error(errorMessage)
      }

      return await response.json()
    } catch (error) {
      // ネットワークエラーなどの場合、リトライ
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (retryCount < maxRetries && !errorMessage.includes('APIキーが無効')) {
        const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000
        console.log(`Transcription failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.transcribeAudio(audioBlob, options, retryCount + 1)
      }
      
      throw error
    }
  }

  async transcribeMultipleSegments(
    segments: { blob: Blob; index: number; startTime: number; endTime: number }[],
    options: TranscriptionOptions = {},
    onProgress?: (completed: number, total: number) => void,
    concurrency: number = 5
  ): Promise<Array<TranscriptionResult & { index: number; startTime: number; endTime: number }>> {
    const results: Array<TranscriptionResult & { index: number; startTime: number; endTime: number }> = []
    const errors: Array<{ index: number; error: string; retryCount: number }> = []
    const failedSegments: Array<{ blob: Blob; index: number; startTime: number; endTime: number; retryCount: number }> = []

    console.log(`=== 並列文字起こし開始 ===`)
    console.log(`セグメント数: ${segments.length}, 並列数: ${concurrency}`)

    // セマフォを使用した並列制御
    const semaphore = new Semaphore(concurrency)
    
    const processSegment = async (segment: { blob: Blob; index: number; startTime: number; endTime: number }, retryCount: number = 0) => {
      return semaphore.acquire(async () => {
        try {
          console.log(`セグメント ${segment.index} の処理開始 (リトライ: ${retryCount})`)
          const result = await this.transcribeAudio(segment.blob, options, retryCount)
          const resultWithMeta = {
            ...result,
            index: segment.index,
            startTime: segment.startTime,
            endTime: segment.endTime
          }
          results.push(resultWithMeta)
          
          console.log(`セグメント ${segment.index} 成功: ${result.text.length}文字`)
          
          if (onProgress) {
            onProgress(results.length + errors.length, segments.length)
          }
          
          return resultWithMeta
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorInfo = {
            index: segment.index,
            error: errorMessage,
            retryCount
          }
          errors.push(errorInfo)
          
          console.error(`セグメント ${segment.index} 失敗:`, errorMessage)
          
          // リトライ可能なエラーの場合、失敗したセグメントリストに追加
          if (retryCount < 2 && !errorMessage.includes('APIキーが無効')) {
            failedSegments.push({
              ...segment,
              retryCount: retryCount + 1
            })
          }
          
          if (onProgress) {
            onProgress(results.length + errors.length, segments.length)
          }
          
          throw error
        }
      })
    }

    // 最初の処理を実行
    const promises = segments.map(segment => processSegment(segment))
    await Promise.allSettled(promises)
    
    // 失敗したセグメントをリトライ
    if (failedSegments.length > 0) {
      console.log(`リトライ開始: ${failedSegments.length}個のセグメント`)
      
      const retryPromises = failedSegments.map(segment => 
        processSegment(segment, segment.retryCount)
      )
      await Promise.allSettled(retryPromises)
    }
    
    // 最終的なエラー統計
    const finalErrors = errors.filter(e => e.retryCount >= 2 || e.error.includes('APIキーが無効'))
    if (finalErrors.length > 0) {
      console.warn(`${finalErrors.length}個のセグメントが最終的に失敗:`, finalErrors)
    }

    console.log(`=== 並列文字起こし完了 ===`)
    console.log(`成功: ${results.length}, 失敗: ${finalErrors.length}`)

    // 結果をインデックス順にソート
    results.sort((a, b) => a.index - b.index)
    
    return results
  }

  mergeTranscriptionResults(
    results: Array<TranscriptionResult & { index: number; startTime: number; endTime: number }>
  ): TranscriptionResult {
    if (results.length === 0) {
      return {
        text: '',
        segments: [],
        words: [],
        language: 'ja',
        duration: 0
      }
    }

    const mergedText = results.map(result => result.text.trim()).join(' ')
    const mergedSegments: TranscriptionSegment[] = []
    const mergedWords: TranscriptionWord[] = []
    let totalDuration = 0

    results.forEach((result) => {
      const timeOffset = result.startTime

      // セグメントのマージ
      result.segments.forEach(segment => {
        mergedSegments.push({
          ...segment,
          id: mergedSegments.length,
          start: segment.start + timeOffset,
          end: segment.end + timeOffset
        })
      })

      // 単語のマージ
      result.words.forEach(word => {
        mergedWords.push({
          ...word,
          start: word.start + timeOffset,
          end: word.end + timeOffset
        })
      })

      totalDuration = Math.max(totalDuration, result.endTime)
    })

    return {
      text: mergedText,
      segments: mergedSegments,
      words: mergedWords,
      language: results[0].language,
      duration: totalDuration
    }
  }
}

class Semaphore {
  private permits: number
  private tasks: Array<() => void> = []
  private lastRequestTime: number = 0
  private readonly minInterval: number = 3000 // 3秒間隔（20リクエスト/分の制限を考慮）

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          // レート制限を考慮した遅延
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < this.minInterval) {
            const delay = this.minInterval - timeSinceLastRequest
            console.log(`Rate limiting: waiting ${delay}ms before next request`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
          this.lastRequestTime = Date.now()
          
          const result = await task()
          this.release()
          resolve(result)
        } catch (error) {
          this.release()
          reject(error)
        }
      }

      if (this.permits > 0) {
        this.permits--
        wrappedTask()
      } else {
        this.tasks.push(wrappedTask)
      }
    })
  }

  private release() {
    this.permits++
    if (this.tasks.length > 0) {
      this.permits--
      const task = this.tasks.shift()!
      task()
    }
  }
}