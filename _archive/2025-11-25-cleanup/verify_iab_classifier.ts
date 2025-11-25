
import { buildWorkflowGraph } from './src/browser/agents/iab-classifier/index'
import { IABTaxonomyLoader } from './src/browser/taxonomy'

// Mock IndexedDBStore
const mockStore = {
  put: async () => {},
  get: async () => null,
  delete: async () => {},
  list: async () => [],
  search: async () => []
}

async function verifyIABClassifier() {
  console.log('🚀 Starting IAB Classifier Verification...')

  // 1. Initialize Dependencies
  console.log('📦 Initializing dependencies...')
  // IABTaxonomyLoader loads in constructor
  IABTaxonomyLoader.getInstance()
  console.log('✅ Taxonomy loaded')

  // 2. Build Workflow Graph
  console.log('🏗️ Building workflow graph...')
  const graph = buildWorkflowGraph(mockStore as any, undefined)

  // 3. Define Test Data (Shopping Scenario)
  const emails = [
    {
      id: 'email_1',
      subject: 'Your Amazon Order',
      from: 'auto-confirm@amazon.com',
      body: 'Thank you for your purchase of Sony Headphones. Order #12345.',
      summary: 'Order confirmation for Sony Headphones',
      timestamp: new Date().toISOString()
    },
    {
      id: 'email_2',
      subject: 'Your receipt from Apple',
      from: 'no_reply@email.apple.com',
      body: 'Receipt for your purchase of iPhone 15 Pro.',
      summary: 'Receipt for iPhone 15 Pro',
      timestamp: new Date().toISOString()
    }
  ]

  console.log(`📧 Processing ${emails.length} emails...`)

  // 4. Run Classification
  try {
    const workflowInput = {
      user_id: 'verify_user_1',
      emails: emails,
      llm_provider: 'openai',
      llm_model: 'gpt-4o'
    }

    const result = await graph.invoke(workflowInput)

    console.log('✅ Classification completed!')
    
    // Collect all classifications
    const allClassifications = [
      ...(result.demographics_results || []),
      ...(result.household_results || []),
      ...(result.interests_results || []),
      ...(result.purchase_results || []),
    ]

    console.log(`📊 Total Classifications: ${allClassifications.length}`)
    console.log('📝 Classifications:', JSON.stringify(allClassifications, null, 2))

    // 5. Verify Output Structure
    if (allClassifications.length > 0) {
      console.log(`🎉 Success! Got ${allClassifications.length} classifications.`)
      
      // Check for specific expected classifications
      const hasElectronics = allClassifications.some((c: any) => 
        (c.value && (c.value.includes('Electronics') || c.value.includes('Shopping'))) ||
        (c.tier_path && (c.tier_path.includes('Electronics') || c.tier_path.includes('Shopping')))
      )
      
      if (hasElectronics) {
        console.log('✅ Found expected Electronics/Shopping classification.')
      } else {
        console.warn('⚠️ Did not find expected Electronics/Shopping classification. Check taxonomy mapping.')
      }

      // Check provenance
      const hasProvenance = allClassifications.every((c: any) => c.email_ids && c.email_ids.length > 0)
      if (hasProvenance) {
        console.log('✅ All classifications have email_ids (provenance tracking working).')
      } else {
        console.error('❌ Some classifications missing email_ids!')
        allClassifications.forEach((c: any, i: number) => {
            if (!c.email_ids || c.email_ids.length === 0) {
                console.error(`   - Classification ${i} (${c.value}) missing email_ids`)
            }
        })
      }

    } else {
      console.error('❌ No classifications returned. Workflow failed to extract data.')
    }

  } catch (error) {
    console.error('❌ Verification failed with error:', error)
  }
}

// Run verification
verifyIABClassifier().catch(console.error)
