/**
 * Analysis Runner Page
 *
 * Allows users to run IAB classification on text input.
 * Displays results and stores classifications in IndexedDB.
 */

'use client'

import { useState } from 'react'
import { getClassifierAPI, type ClassificationResult } from '@/lib/classifier-api'

export default function AnalyzePage() {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [userId, setUserId] = useState('default_user')

  const handleAnalyze = async () => {
    if (!text.trim()) {
      alert('Please enter some text to analyze')
      return
    }

    setRunning(true)
    setResult(null)

    try {
      const api = getClassifierAPI(userId)
      const classificationResult = await api.classifyText({
        user_id: userId,
        text: text.trim(),
        source: 'manual_input',
        source_item_id: `manual_${Date.now()}`,
        llm_provider: 'openai',
        llm_model: 'gpt-4o-mini',
      })

      setResult(classificationResult)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setRunning(false)
    }
  }

  const handleClear = () => {
    setText('')
    setResult(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analysis Runner</h1>
        <p className="text-gray-600 mt-1">
          Run IAB Taxonomy classification on text input
        </p>
      </div>

      {/* User ID Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          User ID
        </label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="default_user"
        />
        <p className="text-xs text-gray-500 mt-1">
          Classifications will be stored for this user ID
        </p>
      </div>

      {/* Text Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Text to Analyze
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          placeholder="Enter email text, transaction description, or any other content to classify..."
        />
        <p className="text-xs text-gray-500 mt-1">
          {text.length} characters
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={handleAnalyze}
          disabled={running || !text.trim()}
          className={`px-6 py-3 rounded-lg font-medium ${
            running || !text.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {running ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running Classification...
            </span>
          ) : (
            'Run IAB Classification'
          )}
        </button>

        <button
          onClick={handleClear}
          disabled={running}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Classification Results
          </h2>

          {result.success && result.classification ? (
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-900 font-medium">
                  ✅ Classification Successful
                </p>
              </div>

              {/* Classification Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Section</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">
                    {result.classification.section}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {result.classification.category}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Confidence</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {Math.round(result.classification.confidence * 100)}%
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${result.classification.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taxonomy ID</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {result.classification.taxonomy_id || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <p className="text-sm text-gray-500 mb-2">LLM Reasoning</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {result.classification.reasoning}
                  </p>
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center space-x-4 pt-4 border-t">
                <a
                  href="/profile"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Profile →
                </a>
                <a
                  href="/classifications"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All Classifications →
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-900 font-medium mb-2">
                ❌ Classification Failed
              </p>
              <p className="text-red-700 text-sm">
                {result.error || 'Unknown error occurred'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          How It Works
        </h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• Runs 4 IAB analyzer agents (Demographics, Household, Interests, Purchase Intent)</li>
          <li>• Uses OpenAI GPT-4o-mini for classification</li>
          <li>• Stores results in browser IndexedDB (self-sovereign)</li>
          <li>• Results appear immediately in Profile and Classifications pages</li>
          <li>• All processing happens locally in your browser</li>
        </ul>
      </div>
    </div>
  )
}
