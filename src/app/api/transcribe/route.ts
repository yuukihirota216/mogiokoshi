import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Groq API key is not configured. Please set GROQ_API_KEY environment variable in Vercel.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('file') as File
    const language = formData.get('language') as string || 'ja'
    const model = formData.get('model') as string || 'whisper-large-v3-turbo'

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // ファイルサイズチェック（Vercelの制限を考慮）
    const maxSize = 25 * 1024 * 1024 // 25MB（Vercelの推奨制限）
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: `File size too large. Maximum size is ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes`)

    // Groq APIに送信するFormDataを作成
    const groqFormData = new FormData()
    groqFormData.append('file', audioFile)
    groqFormData.append('model', model)
    groqFormData.append('language', language)
    groqFormData.append('response_format', 'verbose_json')
    groqFormData.append('timestamp_granularities[]', 'word')

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: groqFormData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Groq API Error:', errorData)
      
      // より詳細なエラーメッセージ
      let errorMessage = `Groq API error: ${response.status} ${response.statusText}`
      if (response.status === 401) {
        errorMessage = 'APIキーが無効です。Vercelの環境変数でGROQ_API_KEYを正しく設定してください。'
      } else if (response.status === 429) {
        errorMessage = 'レート制限に達しました。しばらく待ってから再試行してください。'
      } else if (response.status === 413) {
        errorMessage = 'ファイルサイズが大きすぎます。25MB以下のファイルをご利用ください。'
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      text: result.text,
      segments: result.segments || [],
      words: result.words || [],
      language: result.language,
      duration: result.duration
    })

  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}