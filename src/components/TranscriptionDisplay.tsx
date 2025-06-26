'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TranscriptionResult, TranscriptionSegment } from '@/utils/apiUtils'

interface TranscriptionDisplayProps {
  result: TranscriptionResult | null
  onExport: (format: string, data: string) => void
}

export default function TranscriptionDisplay({ result, onExport }: TranscriptionDisplayProps) {
  const [editedText, setEditedText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [viewMode, setViewMode] = useState<'full' | 'segments' | 'words'>('full')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle')

  // 結果が変更されたら編集テキストも更新
  React.useEffect(() => {
    if (result) {
      setEditedText(result.text)
    }
  }, [result])

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    const milliseconds = Math.floor((seconds % 1) * 1000)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
  }, [])

  const highlightedText = useMemo(() => {
    if (!searchQuery || !editedText) return editedText
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return editedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
  }, [editedText, searchQuery])

  const exportToFormat = useCallback((format: string) => {
    if (!result) return

    let exportData = ''
    
    switch (format) {
      case 'txt':
        exportData = editedText
        break
        
      case 'srt':
        exportData = result.segments.map((segment, index) => {
          const startTime = formatTime(segment.start).replace('.', ',')
          const endTime = formatTime(segment.end).replace('.', ',')
          return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n`
        }).join('\n')
        break
        
      case 'vtt':
        exportData = 'WEBVTT\n\n' + result.segments.map(segment => {
          const startTime = formatTime(segment.start)
          const endTime = formatTime(segment.end)
          return `${startTime} --> ${endTime}\n${segment.text.trim()}\n`
        }).join('\n')
        break
        
      case 'json':
        exportData = JSON.stringify({
          text: editedText,
          originalText: result.text,
          segments: result.segments,
          words: result.words,
          language: result.language,
          duration: result.duration,
          exportedAt: new Date().toISOString()
        }, null, 2)
        break
        
      default:
        return
    }
    
    onExport(format, exportData)
  }, [result, editedText, formatTime, onExport])

  const copyToClipboard = useCallback(async () => {
    setCopyStatus('copying')
    
    try {
      // 方法1: モダンなClipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(editedText)
        console.log('コピー成功（Clipboard API）')
        setCopyStatus('success')
        setTimeout(() => setCopyStatus('idle'), 2000)
        return
      }
      
      // 方法2: フォールバック（古いブラウザ対応）
      const textArea = document.createElement('textarea')
      textArea.value = editedText
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (successful) {
        console.log('コピー成功（execCommand）')
        setCopyStatus('success')
        setTimeout(() => setCopyStatus('idle'), 2000)
      } else {
        console.error('コピー失敗（execCommand）')
        setCopyStatus('error')
        setTimeout(() => setCopyStatus('idle'), 2000)
      }
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
      
      // 方法3: 最終フォールバック（ユーザーに手動コピーを促す）
      try {
        const textArea = document.createElement('textarea')
        textArea.value = editedText
        textArea.style.position = 'fixed'
        textArea.style.left = '50%'
        textArea.style.top = '50%'
        textArea.style.transform = 'translate(-50%, -50%)'
        textArea.style.zIndex = '9999'
        textArea.style.width = '80%'
        textArea.style.height = '200px'
        textArea.style.padding = '10px'
        textArea.style.border = '2px solid #ccc'
        textArea.style.borderRadius = '5px'
        textArea.style.backgroundColor = 'white'
        textArea.style.fontSize = '14px'
        textArea.style.fontFamily = 'monospace'
        
        const overlay = document.createElement('div')
        overlay.style.position = 'fixed'
        overlay.style.top = '0'
        overlay.style.left = '0'
        overlay.style.width = '100%'
        overlay.style.height = '100%'
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        overlay.style.zIndex = '9998'
        
        const closeButton = document.createElement('button')
        closeButton.textContent = '閉じる'
        closeButton.style.position = 'absolute'
        closeButton.style.top = '10px'
        closeButton.style.right = '10px'
        closeButton.style.padding = '5px 10px'
        closeButton.style.backgroundColor = '#f44336'
        closeButton.style.color = 'white'
        closeButton.style.border = 'none'
        closeButton.style.borderRadius = '3px'
        closeButton.style.cursor = 'pointer'
        
        const copyButton = document.createElement('button')
        copyButton.textContent = 'テキストを選択してコピー'
        copyButton.style.position = 'absolute'
        copyButton.style.bottom = '10px'
        copyButton.style.left = '50%'
        copyButton.style.transform = 'translateX(-50%)'
        copyButton.style.padding = '10px 20px'
        copyButton.style.backgroundColor = '#4CAF50'
        copyButton.style.color = 'white'
        copyButton.style.border = 'none'
        copyButton.style.borderRadius = '5px'
        copyButton.style.cursor = 'pointer'
        
        copyButton.onclick = () => {
          textArea.select()
          textArea.setSelectionRange(0, 99999)
        }
        
        closeButton.onclick = () => {
          document.body.removeChild(overlay)
        }
        
        overlay.appendChild(textArea)
        overlay.appendChild(closeButton)
        overlay.appendChild(copyButton)
        document.body.appendChild(overlay)
        
        textArea.focus()
        textArea.select()
        
      } catch (fallbackError) {
        console.error('フォールバックコピーも失敗:', fallbackError)
        alert('コピーに失敗しました。テキストを手動でコピーしてください。')
      }
    }
  }, [editedText])

  if (!result) {
    return null
  }

  const wordCount = editedText.split(/\s+/).filter(word => word.length > 0).length
  const estimatedReadingTime = Math.ceil(wordCount / 200) // 1分間に200語として計算

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 space-y-4">
      {/* 統計情報 */}
      <Card>
        <CardHeader>
          <CardTitle>文字起こし結果</CardTitle>
          <CardDescription>
            言語: {result.language} | 
            音声時間: {formatTime(result.duration)} | 
            文字数: {editedText.length} | 
            単語数: {wordCount} | 
            推定読み時間: {estimatedReadingTime}分
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 検索とアクション */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="テキスト内を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'full' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('full')}
              >
                全文
              </Button>
              <Button
                variant={viewMode === 'segments' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('segments')}
              >
                セグメント
              </Button>
              <Button
                variant={viewMode === 'words' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('words')}
              >
                単語別
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              onClick={copyToClipboard}
              disabled={copyStatus === 'copying'}
              variant={copyStatus === 'success' ? 'default' : copyStatus === 'error' ? 'destructive' : 'default'}
            >
              {copyStatus === 'copying' ? 'コピー中...' : 
               copyStatus === 'success' ? 'コピー完了！' : 
               copyStatus === 'error' ? 'コピー失敗' : 'コピー'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToFormat('txt')}>
              TXT
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToFormat('srt')}>
              SRT
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToFormat('vtt')}>
              VTT
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToFormat('json')}>
              JSON
            </Button>
            <Button 
              size="sm" 
              variant={isEditing ? 'destructive' : 'secondary'}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? '編集完了' : '編集'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* メインコンテンツ */}
      <Card>
        <CardContent className="pt-6">
          {viewMode === 'full' && (
            <div className="space-y-4">
              {isEditing ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-96 p-4 border rounded-md font-mono text-sm resize-y"
                  placeholder="文字起こし結果を編集..."
                />
              ) : (
                <div 
                  className="prose max-w-none p-4 bg-gray-50 rounded-md min-h-48 whitespace-pre-wrap text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlightedText }}
                />
              )}
            </div>
          )}

          {viewMode === 'segments' && (
            <div className="space-y-3">
              {result.segments.map((segment, index) => (
                <SegmentDisplay
                  key={index}
                  segment={segment}
                  index={index}
                  searchQuery={searchQuery}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}

          {viewMode === 'words' && (
            <div className="space-y-2">
              {result.words.map((word, index) => (
                <span
                  key={index}
                  className="inline-block m-1 px-2 py-1 bg-blue-50 rounded text-xs border"
                  title={`${formatTime(word.start)} - ${formatTime(word.end)}`}
                >
                  {word.word}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface SegmentDisplayProps {
  segment: TranscriptionSegment
  index: number
  searchQuery: string
  formatTime: (seconds: number) => string
}

function SegmentDisplay({ segment, index, searchQuery, formatTime }: SegmentDisplayProps) {
  const highlightedText = useMemo(() => {
    if (!searchQuery) return segment.text
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return segment.text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
  }, [segment.text, searchQuery])

  return (
    <div className="flex gap-4 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
      <div className="flex-shrink-0 text-xs text-gray-500 font-mono min-w-24">
        <div>{formatTime(segment.start)}</div>
        <div>{formatTime(segment.end)}</div>
      </div>
      <div 
        className="flex-1 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlightedText }}
      />
      <div className="flex-shrink-0 text-xs text-gray-400">
        #{index + 1}
      </div>
    </div>
  )
}