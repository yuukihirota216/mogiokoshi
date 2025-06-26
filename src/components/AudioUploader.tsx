'use client'

import React, { useCallback, useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AudioUploaderProps {
  onFileSelect: (file: File) => void
  isProcessing: boolean
}

const SUPPORTED_FORMATS = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/x-m4a']
const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export default function AudioUploader({ onFileSelect, isProcessing }: AudioUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ファイル入力要素の初期化
  useEffect(() => {
    if (fileInputRef.current) {
      console.log('File input element initialized')
      // ファイル入力要素を確実に設定
      fileInputRef.current.accept = 'audio/*,.mp3,.wav,.m4a,.ogg,.flac'
      fileInputRef.current.multiple = false
      fileInputRef.current.style.display = 'none'
      
      // イベントリスナーを直接追加
      const handleInputChange = (e: Event) => {
        console.log('Direct event listener triggered')
        const target = e.target as HTMLInputElement
        if (target.files && target.files.length > 0) {
          console.log('File selected via direct listener:', target.files[0])
          // handleFileは後で定義されるので、ここでは直接onFileSelectを呼び出す
          const file = target.files[0]
          const validation = validateFile(file)
          if (validation) {
            setError(validation)
            return
          }
          setError(null)
          setSelectedFile(file)
          onFileSelect(file)
        }
      }
      
      fileInputRef.current.addEventListener('change', handleInputChange)
      fileInputRef.current.addEventListener('input', handleInputChange)
      
      // クリーンアップ
      return () => {
        if (fileInputRef.current) {
          fileInputRef.current.removeEventListener('change', handleInputChange)
          fileInputRef.current.removeEventListener('input', handleInputChange)
        }
      }
    }
  }, [onFileSelect])

  const validateFile = (file: File): string | null => {
    // MIMEタイプの確認
    const isValidMimeType = SUPPORTED_FORMATS.includes(file.type)
    
    // ファイル拡張子の確認
    const fileName = file.name.toLowerCase()
    const isValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext))
    
    console.log('File validation:', {
      name: file.name,
      type: file.type,
      isValidMimeType,
      isValidExtension
    })
    
    if (!isValidMimeType && !isValidExtension) {
      return '対応していないファイル形式です。MP3, WAV, M4A, OGG, FLACをご利用ください。'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'ファイルサイズが100MBを超えています。'
    }
    return null
  }

  const handleFile = useCallback((file: File) => {
    console.log('=== handleFile called ===')
    console.log('File object:', file)
    console.log('File name:', file.name)
    console.log('File type:', file.type)
    console.log('File size:', file.size)
    console.log('File lastModified:', file.lastModified)
    
    // ファイルの詳細情報をログ出力
    console.log('File constructor:', file.constructor.name)
    console.log('File instanceof File:', file instanceof File)
    
    const validation = validateFile(file)
    console.log('Validation result:', validation)
    
    if (validation) {
      console.log('Validation error:', validation)
      setError(validation)
      return
    }
    
    console.log('File validation passed')
    setError(null)
    setSelectedFile(file)
    console.log('Calling onFileSelect with file:', file)
    onFileSelect(file)
    console.log('=== handleFile completed ===')
  }, [onFileSelect])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Drag event:', e.type)
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    console.log('Drop event triggered')
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      console.log('File dropped:', e.dataTransfer.files[0])
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change event triggered')
    console.log('Event target:', e.target)
    console.log('Files:', e.target.files)
    console.log('Files length:', e.target.files?.length)
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      console.log('File selected:', file)
      console.log('File name:', file.name)
      console.log('File type:', file.type)
      console.log('File size:', file.size)
      handleFile(file)
    } else {
      console.log('No files selected')
    }
    
    // ファイル選択後にinputの値をクリア（同じファイルを再度選択できるように）
    e.target.value = ''
  }, [handleFile])

  const triggerFileInput = useCallback(() => {
    console.log('triggerFileInput called')

    // 動的にinput要素を作成
    const newInput = document.createElement('input')
    newInput.type = 'file'
    newInput.accept = 'audio/*,.mp3,.wav,.m4a,.ogg,.flac'
    newInput.multiple = false
    newInput.style.position = 'absolute'
    newInput.style.left = '-9999px'
    newInput.style.top = '-9999px'

    const handleFileSelect = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.files && target.files.length > 0) {
        const file = target.files[0]
        const validation = validateFile(file)
        if (validation) {
          setError(validation)
        } else {
          setError(null)
          setSelectedFile(file)
          onFileSelect(file)
        }
      }
      // イベントリスナーを即解除し、要素も即削除
      newInput.removeEventListener('change', handleFileSelect)
      if (document.body.contains(newInput)) {
        document.body.removeChild(newInput)
      }
    }

    newInput.addEventListener('change', handleFileSelect, { once: true })
    document.body.appendChild(newInput)
    newInput.click()
  }, [onFileSelect])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>音声ファイルアップロード</CardTitle>
        <CardDescription>
          MP3, WAV, M4A, OGG, FLACファイルをドラッグ&ドロップまたは選択してください（最大100MB）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-gray-400'
          } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!isProcessing && !selectedFile) {
              console.log('Upload area clicked')
              triggerFileInput()
            }
          }}
          style={{ cursor: isProcessing || selectedFile ? 'default' : 'pointer' }}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p className="font-semibold">{selectedFile.name}</p>
                <p>サイズ: {formatFileSize(selectedFile.size)}</p>
                <p>形式: {selectedFile.type}</p>
              </div>
              {!isProcessing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null)
                    setError(null)
                  }}
                >
                  別のファイルを選択
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 text-gray-400">
                <svg
                  className="w-full h-full"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium">音声ファイルをドロップ</p>
                <p className="text-sm text-gray-500">または</p>
              </div>
              <div>
                <input
                  type="file"
                  className="hidden"
                  id="audio-upload"
                  disabled={isProcessing}
                  ref={fileInputRef}
                  onInput={handleFileInput}
                  onChange={handleFileInput}
                />
                <Button 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    triggerFileInput();
                  }}
                >
                  ファイルを選択
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}