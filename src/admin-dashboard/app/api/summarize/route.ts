/**
 * Server-side API Route for Email Summarization
 *
 * Runs LLM summarization on email content with concurrent processing.
 * Used by both /emails page and A/B testing Stage 2.
 */

import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface EmailToSummarize {
  id: string
  subject: string
  from: string
  body: string
  date?: string
}

interface SummarizedEmail extends EmailToSummarize {
  summary: string
  subject_of_email?: 'self' | 'child' | 'spouse' | 'household' | 'other'
  subject_reasoning?: string
}

/**
 * Get API key for the specified provider from environment variables
 */
function getApiKeyForProvider(provider: string): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY
    case 'claude':
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY
    case 'google':
    case 'gemini':
      return process.env.GOOGLE_API_KEY
    case 'groq':
      return process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY
    case 'deepinfra':
      return process.env.DEEPINFRA_API_KEY || process.env.NEXT_PUBLIC_DEEPINFRA_API_KEY
    default:
      console.warn(`[Summarize API] Unknown provider: ${provider}`)
      return undefined
  }
}

/**
 * Summarize a single email using the specified LLM
 */
async function summarizeEmail(
  email: EmailToSummarize,
  provider: string,
  model: string,
  apiKey: string
): Promise<SummarizedEmail> {
  const prompt = `Analyze this email and return ONLY valid JSON (no markdown, no code blocks):
{
  "summary": "2-3 sentence summary focusing on main purpose and action items",
  "subject_of_email": "self|child|spouse|household|other",
  "subject_reasoning": "Brief explanation of who the email is about"
}

Rules for subject_of_email:
- "self": Email is directly about/addressed to the email account owner (default)
- "child": Email is about the owner's child (school, activities, healthcare, parental monitoring)
- "spouse": Email is about the owner's spouse/partner
- "household": Email is about the household generally (bills, family plans)
- "other": Email is about someone else (friend, colleague, forwarded content)

Signals for "child":
- Google Classroom, school emails, parent portal
- "Daily summary for [Name]" where Name is NOT the email recipient
- Homework, report cards, school activities
- "Your child", "Your son/daughter", "Your student"
- Parental monitoring or activity summaries for minors

Email to analyze:
Subject: ${email.subject}
From: ${email.from}

${email.body}`

  try {
    let responseContent = ''

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey })
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      })
      responseContent = response.choices[0]?.message?.content || ''
    } else if (provider === 'google' || provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey)
      const genModel = genAI.getGenerativeModel({ model })
      const result = await genModel.generateContent(prompt)
      responseContent = result.response.text()
    } else if (provider === 'groq') {
      // Groq uses OpenAI-compatible API
      const groqClient = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      })
      const response = await groqClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      })
      responseContent = response.choices[0]?.message?.content || ''
    } else if (provider === 'deepinfra') {
      // DeepInfra uses OpenAI-compatible API
      const deepinfraClient = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepinfra.com/v1/openai',
      })
      const response = await deepinfraClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      })
      responseContent = response.choices[0]?.message?.content || ''
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    // Parse JSON response
    let jsonContent = responseContent.trim()
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7)
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3)
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3)
    }
    jsonContent = jsonContent.trim()

    const parsed = JSON.parse(jsonContent)

    return {
      ...email,
      summary: parsed.summary || responseContent,
      subject_of_email: parsed.subject_of_email || 'self',
      subject_reasoning: parsed.subject_reasoning || '',
    }
  } catch (error: any) {
    console.error(`[Summarize API] Error for email ${email.id}:`, error.message)
    // Fallback to substring
    return {
      ...email,
      summary: email.body.substring(0, 500),
      subject_of_email: 'self',
      subject_reasoning: 'Fallback - summarization failed',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { emails, provider = 'openai', model = 'gpt-4o-mini', max_concurrent = 5 } = body

    console.log(`[Summarize API] Request: ${emails?.length || 0} emails, provider=${provider}, model=${model}`)

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: emails array' },
        { status: 400 }
      )
    }

    // Get API key for provider
    const apiKey = getApiKeyForProvider(provider)
    if (!apiKey) {
      console.error(`[Summarize API] No API key found for provider: ${provider}`)
      return NextResponse.json(
        { success: false, error: `No API key configured for ${provider}` },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    const summarizedEmails: SummarizedEmail[] = []

    // Process emails in chunks (concurrent processing like Python's ThreadPoolExecutor)
    const chunks: EmailToSummarize[][] = []
    for (let i = 0; i < emails.length; i += max_concurrent) {
      chunks.push(emails.slice(i, i + max_concurrent))
    }

    console.log(`[Summarize API] Processing ${emails.length} emails in ${chunks.length} chunks of ${max_concurrent}`)

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      console.log(`[Summarize API] Chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.length} emails`)

      // Process chunk in parallel
      const promises = chunk.map(email => summarizeEmail(email, provider, model, apiKey))
      const results = await Promise.all(promises)
      summarizedEmails.push(...results)

      console.log(`[Summarize API] Chunk ${chunkIndex + 1} complete`)
    }

    const endTime = Date.now()
    const durationMs = endTime - startTime

    console.log(`[Summarize API] Complete: ${summarizedEmails.length} emails in ${durationMs}ms`)

    return NextResponse.json({
      success: true,
      emails: summarizedEmails,
      stats: {
        total: summarizedEmails.length,
        llm_summaries: summarizedEmails.filter(e => e.summary && e.summary.length > 500).length,
        fallback_summaries: summarizedEmails.filter(e => !e.summary || e.summary.length <= 500).length,
        duration_ms: durationMs,
      },
    })
  } catch (error: any) {
    console.error('[Summarize API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
