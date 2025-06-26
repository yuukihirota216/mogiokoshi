export class ExportUtils {
  static downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // メモリリークを防ぐためにURLを解放
    URL.revokeObjectURL(url)
  }

  static generateFilename(originalFilename: string, format: string): string {
    // 元のファイル名から拡張子を除去
    const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    return `${nameWithoutExt}_transcription_${timestamp}.${format}`
  }

  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    const milliseconds = Math.floor((seconds % 1) * 1000)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
    }
  }

  static formatSRTTime(seconds: number): string {
    const formatted = this.formatDuration(seconds)
    return formatted.replace('.', ',')
  }

  static escapeFileName(filename: string): string {
    // ファイル名に使用できない文字を置換
    return filename.replace(/[<>:"/\\|?*]/g, '_')
  }

  static validateExportData(data: string, format: string): boolean {
    if (!data || data.trim().length === 0) {
      return false
    }

    switch (format) {
      case 'json':
        try {
          JSON.parse(data)
          return true
        } catch {
          return false
        }
      case 'srt':
        // SRT形式の基本的な検証
        return /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}\s*\n.+/m.test(data)
      case 'vtt':
        // VTT形式の基本的な検証
        return data.startsWith('WEBVTT') && /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\s*\n.+/m.test(data)
      case 'txt':
        return true // テキストファイルは常に有効
      default:
        return false
    }
  }

  static getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'srt': 'application/x-subrip',
      'vtt': 'text/vtt',
      'json': 'application/json',
      'csv': 'text/csv',
      'xml': 'application/xml'
    }
    
    return mimeTypes[format] || 'text/plain'
  }

  static getFileExtension(format: string): string {
    const extensions: Record<string, string> = {
      'txt': 'txt',
      'srt': 'srt',
      'vtt': 'vtt',
      'json': 'json',
      'csv': 'csv',
      'xml': 'xml'
    }
    
    return extensions[format] || 'txt'
  }

  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      } else {
        // フォールバック: 古いブラウザ対応
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const result = document.execCommand('copy')
        document.body.removeChild(textArea)
        return result
      }
    } catch (error) {
      console.error('クリップボードへのコピーに失敗:', error)
      return false
    }
  }

  static calculateReadingTime(text: string, wordsPerMinute: number = 200): number {
    const words = text.split(/\s+/).filter(word => word.length > 0).length
    return Math.ceil(words / wordsPerMinute)
  }

  static getTextStatistics(text: string): {
    characters: number
    charactersNoSpaces: number
    words: number
    sentences: number
    paragraphs: number
    readingTime: number
  } {
    const characters = text.length
    const charactersNoSpaces = text.replace(/\s/g, '').length
    const words = text.split(/\s+/).filter(word => word.length > 0).length
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length
    const paragraphs = text.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0).length
    const readingTime = this.calculateReadingTime(text)

    return {
      characters,
      charactersNoSpaces,
      words,
      sentences,
      paragraphs,
      readingTime
    }
  }

  static generateCSVFromSegments(segments: Array<{
    start: number
    end: number
    text: string
    [key: string]: unknown
  }>): string {
    const headers = ['Start Time', 'End Time', 'Duration', 'Text']
    const rows = segments.map(segment => [
      this.formatDuration(segment.start),
      this.formatDuration(segment.end),
      this.formatDuration(segment.end - segment.start),
      `"${segment.text.replace(/"/g, '""')}"`
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }

  static generateXMLFromResult(result: {
    text: string
    segments: Array<{
      start: number
      end: number
      text: string
      [key: string]: unknown
    }>
    language: string
    duration: number
  }): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<transcription>
  <metadata>
    <language>${result.language}</language>
    <duration>${result.duration}</duration>
    <generated>${new Date().toISOString()}</generated>
  </metadata>
  <text><![CDATA[${result.text}]]></text>
  <segments>
${result.segments.map(segment => `    <segment start="${segment.start}" end="${segment.end}">
      <text><![CDATA[${segment.text}]]></text>
    </segment>`).join('\n')}
  </segments>
</transcription>`

    return xml
  }
}