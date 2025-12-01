export const lookupTaxonomyEntry = (id: string) => {
  console.log(`MANUAL MOCK lookupTaxonomyEntry called with id: ${id} (type: ${typeof id})`)
  if (String(id) === '25') return { 
    tier_1: 'Shopping', 
    category_path: 'Shopping',
    grouping_tier_key: 'tier_1'
  }
  if (String(id) === '13') return { 
    tier_1: 'Personal Finance', 
    category_path: 'Personal Finance',
    grouping_tier_key: 'tier_1'
  }
  if (String(id) === '29') return { 
    tier_1: 'Travel', 
    category_path: 'Travel',
    grouping_tier_key: 'tier_1'
  }
  return null
}

export const validateTaxonomyClassification = () => true
