'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AudioProcessor as AudioUtil, AudioSplitOptions } from '@/utils/audioUtils'
import { GroqAPIClient, TranscriptionResult, TranscriptionOptions } from '@/utils/apiUtils'

interface AudioProcessorProps {
  file: File | null
  onTranscriptionComplete: (result: TranscriptionResult) => void
  onError: (error: string) => void
}

interface ProcessingState {
  stage: 'idle' | 'splitting' | 'transcribing' | 'merging' | 'completed' | 'error'
  progress: number
  message: string
  segmentsTotal: number
  segmentsProcessed: number
}

export default function AudioProcessor({ file, onTranscriptionComplete, onError }: AudioProcessorProps) {
  const [processing, setProcessing] = useState<ProcessingState>({
    stage: 'idle',
    progress: 0,
    message: '',
    segmentsTotal: 0,
    segmentsProcessed: 0
  })
  
  const [settings, setSettings] = useState({
    segmentDuration: 60, // 60秒
    overlap: 1, // 1秒のオーバーラップ
    language: 'ja',
    concurrency: 3 // デフォルトを3に変更
  })

  const audioUtilRef = useRef<AudioUtil | null>(null)
  const apiClientRef = useRef<GroqAPIClient | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const initializeProcessors = useCallback(() => {
    if (!audioUtilRef.current) {
      audioUtilRef.current = new AudioUtil()
    }
    if (!apiClientRef.current) {
      apiClientRef.current = new GroqAPIClient()
    }
  }, [])

  const startTranscription = useCallback(async () => {
    if (!file) return

    try {
      initializeProcessors()
      abortControllerRef.current = new AbortController()

      // 1. 音声分割段階
      setProcessing({
        stage: 'splitting',
        progress: 0,
        message: '音声ファイルを分割しています...',
        segmentsTotal: 0,
        segmentsProcessed: 0
      })

      const splitOptions: AudioSplitOptions = {
        segmentDuration: settings.segmentDuration,
        overlap: settings.overlap
      }

      const segments = await audioUtilRef.current!.splitAudioFile(file, splitOptions)
      
      if (segments.length === 0) {
        throw new Error('音声ファイルの分割に失敗しました')
      }

      setProcessing(prev => ({
        ...prev,
        stage: 'transcribing',
        message: `${segments.length}個のセグメントを並列処理で文字起こししています...`,
        segmentsTotal: segments.length,
        progress: 0
      }))

      // 2. 並列文字起こし段階
      const transcriptionOptions: TranscriptionOptions = {
        language: settings.language
      }

      const segmentData = segments.map(segment => ({
        blob: segment.blob,
        index: segment.index,
        startTime: segment.startTime,
        endTime: segment.endTime
      }))

      const results = await apiClientRef.current!.transcribeMultipleSegments(
        segmentData,
        transcriptionOptions,
        (completed, total) => {
          const progressPercent = (completed / total) * 100
          setProcessing(prev => ({
            ...prev,
            progress: progressPercent,
            segmentsProcessed: completed,
            message: `文字起こし進行中: ${completed}/${total} セグメント完了`
          }))
        },
        settings.concurrency
      )

      // 3. 結果統合段階
      setProcessing(prev => ({
        ...prev,
        stage: 'merging',
        progress: 95,
        message: '結果を統合しています...'
      }))

      const mergedResult = apiClientRef.current!.mergeTranscriptionResults(results)

      // 4. 完了
      const successCount = results.length
      const totalSegments = segments.length
      const failedCount = totalSegments - successCount
      
      let completionMessage = '文字起こしが完了しました！'
      if (failedCount > 0) {
        completionMessage = `文字起こしが完了しました（${successCount}/${totalSegments} セグメント成功、${failedCount} セグメント失敗）`
      }

      setProcessing({
        stage: 'completed',
        progress: 100,
        message: completionMessage,
        segmentsTotal: segments.length,
        segmentsProcessed: segments.length
      })

      onTranscriptionComplete(mergedResult)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました'
      setProcessing({
        stage: 'error',
        progress: 0,
        message: errorMessage,
        segmentsTotal: 0,
        segmentsProcessed: 0
      })
      onError(errorMessage)
    }
  }, [file, settings, onTranscriptionComplete, onError, initializeProcessors])

  const stopTranscription = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setProcessing({
      stage: 'idle',
      progress: 0,
      message: '',
      segmentsTotal: 0,
      segmentsProcessed: 0
    })
  }, [])


  const getStageProgress = (): number => {
    switch (processing.stage) {
      case 'splitting': return 10
      case 'transcribing': return 10 + (processing.progress * 0.8)
      case 'merging': return 95
      case 'completed': return 100
      default: return 0
    }
  }

  if (!file) {
    return null
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>音声処理</CardTitle>
        <CardDescription>
          {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 設定 */}
        {processing.stage === 'idle' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">セグメント長（秒）</label>
                <select 
                  value={settings.segmentDuration}
                  onChange={(e) => setSettings(prev => ({ ...prev, segmentDuration: Number(e.target.value) }))}
                  className="w-full mt-1 p-2 border rounded"
                >
                  <option value={30}>30秒</option>
                  <option value={60}>60秒</option>
                  <option value={120}>120秒</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">並列処理数</label>
                <select 
                  value={settings.concurrency}
                  onChange={(e) => setSettings(prev => ({ ...prev, concurrency: Number(e.target.value) }))}
                  className="w-full mt-1 p-2 border rounded"
                >
                  <option value={2}>2並列（推奨）</option>
                  <option value={3}>3並列</option>
                  <option value={5}>5並列</option>
                  <option value={8}>8並列（注意）</option>
                  <option value={10}>10並列（注意）</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  並列数を上げると速度が向上しますが、レート制限エラーが発生しやすくなります
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">言語</label>
              <select 
                value={settings.language}
                onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                className="w-full mt-1 p-2 border rounded"
              >
                <option value="ja">日本語</option>
                <option value="en">英語</option>
                <option value="auto">自動検出</option>
              </select>
            </div>
          </div>
        )}

        {/* 処理状況 */}
        {processing.stage !== 'idle' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{processing.message}</span>
              <span className="text-sm text-gray-500">
                {processing.stage === 'transcribing' && 
                  `${processing.segmentsProcessed}/${processing.segmentsTotal}`
                }
              </span>
            </div>
            <Progress value={getStageProgress()} className="w-full" />
            
            {processing.stage === 'transcribing' && processing.segmentsTotal > 0 && (
              <div className="text-xs text-gray-500 space-y-1">
                <div>推定残り時間: {Math.ceil((processing.segmentsTotal - processing.segmentsProcessed) / settings.concurrency * 3)}秒</div>
                <div>レート制限対策: リクエスト間隔を3秒に調整中</div>
                {settings.concurrency > 3 && (
                  <div className="text-orange-600">⚠️ 並列数を下げるとレート制限エラーを減らせます</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-2">
          {processing.stage === 'idle' && (
            <Button onClick={startTranscription} className="w-full">
              文字起こしを開始
            </Button>
          )}
          
          {(processing.stage === 'splitting' || processing.stage === 'transcribing') && (
            <Button variant="destructive" onClick={stopTranscription} className="w-full">
              処理を中断
            </Button>
          )}
          
          {processing.stage === 'completed' && (
            <Button 
              variant="outline" 
              onClick={() => setProcessing({
                stage: 'idle',
                progress: 0,
                message: '',
                segmentsTotal: 0,
                segmentsProcessed: 0
              })}
              className="w-full"
            >
              新しいファイルを処理
            </Button>
          )}
          
          {processing.stage === 'error' && (
            <Button 
              onClick={() => setProcessing({
                stage: 'idle',
                progress: 0,
                message: '',
                segmentsTotal: 0,
                segmentsProcessed: 0
              })}
              className="w-full"
            >
              再試行
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}