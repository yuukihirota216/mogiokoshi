'use client'

import React, { useState, useCallback } from 'react'
import AudioUploader from '@/components/AudioUploader'
import AudioProcessor from '@/components/AudioProcessor'
import TranscriptionDisplay from '@/components/TranscriptionDisplay'
import { TranscriptionResult } from '@/utils/apiUtils'
import { ExportUtils } from '@/utils/exportUtils'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setTranscriptionResult(null)
    setError(null)
  }, [])

  const handleTranscriptionComplete = useCallback((result: TranscriptionResult) => {
    setTranscriptionResult(result)
    setIsProcessing(false)
  }, [])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setIsProcessing(false)
  }, [])

  const handleExport = useCallback((format: string, data: string) => {
    if (!selectedFile) return

    const filename = ExportUtils.generateFilename(selectedFile.name, format)
    const mimeType = ExportUtils.getMimeType(format)
    
    ExportUtils.downloadFile(data, filename, mimeType)
  }, [selectedFile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            音声文字起こしツール
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Groq Whisper APIを使用した高速並列文字起こし
          </p>
          <div className="inline-flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Web Audio API
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              並列処理
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              高速文字起こし
            </span>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">閉じる</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="space-y-6">
          {/* ファイルアップロード */}
          <AudioUploader
            onFileSelect={handleFileSelect}
            isProcessing={isProcessing}
          />

          {/* 音声処理 */}
          {selectedFile && (
            <AudioProcessor
              file={selectedFile}
              onTranscriptionComplete={handleTranscriptionComplete}
              onError={handleError}
            />
          )}

          {/* 結果表示 */}
          {transcriptionResult && (
            <TranscriptionDisplay
              result={transcriptionResult}
              onExport={handleExport}
            />
          )}
        </div>

        {/* フッター */}
        <footer className="mt-16 text-center text-sm text-gray-500">
          <div className="space-y-2">
            <p>対応形式: MP3, WAV, M4A, OGG, FLAC（最大100MB）</p>
            <p>エクスポート形式: TXT, SRT, VTT, JSON</p>
            <div className="flex justify-center items-center space-x-4 mt-4">
              <span>Powered by</span>
              <span className="font-semibold">Groq Whisper API</span>
              <span>•</span>
              <span className="font-semibold">Next.js 14</span>
              <span>•</span>
              <span className="font-semibold">Web Audio API</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
