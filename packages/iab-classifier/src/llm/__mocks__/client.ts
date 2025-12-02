export class AnalyzerLLMClient {
  constructor(config: any) {
    console.log('MANUAL MOCK AnalyzerLLMClient initialized with config:', config)
  }

  async analyze_email(params: { prompt: string }) {
    console.log('MANUAL MOCK analyze_email called with prompt:', params.prompt.substring(0, 50))
    const { prompt } = params
    const textMatch = prompt.match(/Text to classify:\s*"""\s*([\s\S]*?)\s*"""/) || 
                      prompt.match(/Subject:.*?\n([\s\S]*)/) // Fallback for batch context
    const text = textMatch ? textMatch[1].toLowerCase() : prompt.toLowerCase()

    // Simple keyword-based classification for testing
    let taxonomy_id = '25' // Shopping
    let value = 'Shopping'
    let confidence = 0.5

    if (text.includes('order') || text.includes('shipped') || text.includes('purchase') || text.includes('amazon')) {
      taxonomy_id = '25'
      value = 'Shopping'
      confidence = 0.95
    } else if (text.includes('bank') || text.includes('payment') || text.includes('transaction') || text.includes('chase')) {
      taxonomy_id = '13' // Personal Finance
      value = 'Personal Finance'
      confidence = 0.92
    } else if (text.includes('flight') || text.includes('hotel') || text.includes('booking') || text.includes('united')) {
      taxonomy_id = '29' // Travel
      value = 'Travel'
      confidence = 0.90
    }
    
    console.log(`MANUAL MOCK analyze_email returning taxonomy_id: ${taxonomy_id} for text: ${text.substring(0, 20)}`)

    // Return structure expected by analyzers (list of classifications)
    return {
      classifications: [{
        taxonomy_id,
        value,
        confidence,
        reasoning: `Classified based on keywords in: "${text.substring(0, 50)}..."`,
        email_ids: ['email_1'] // Mock email ID
      }]
    }
  }

  async call_json(params: { prompt: string }) {
    console.log('MANUAL MOCK call_json called')
    // Mock evidence judge response
    return {
      quality_score: 0.9,
      issue: 'None',
      explanation: 'High quality evidence'
    }
  }
}
