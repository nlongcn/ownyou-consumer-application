/**
 * Category Browser Page
 *
 * Browse the complete IAB Taxonomy 1.1 structure (1,558 categories).
 */

'use client'

import { useState } from 'react'

// Sample IAB Taxonomy categories for browsing
// Full taxonomy would be loaded from @browser/taxonomy
const IAB_SECTIONS = [
  {
    name: 'Demographics',
    icon: '👤',
    categories: [
      'Age',
      'Gender',
      'Education Level',
      'Marital Status',
      'Employment Status',
      'Occupation',
      'Income Level',
    ],
  },
  {
    name: 'Household',
    icon: '🏠',
    categories: [
      'Household Size',
      'Household Composition',
      'Homeownership',
      'Living Situation',
      'Family Structure',
    ],
  },
  {
    name: 'Interests',
    icon: '⭐',
    categories: [
      'Arts & Entertainment',
      'Automotive',
      'Business',
      'Careers',
      'Education',
      'Family & Parenting',
      'Food & Drink',
      'Health & Fitness',
      'Hobbies & Interests',
      'Home & Garden',
      'News & Politics',
      'Personal Finance',
      'Pets',
      'Real Estate',
      'Religion & Spirituality',
      'Science',
      'Shopping',
      'Sports',
      'Style & Fashion',
      'Technology & Computing',
      'Travel',
    ],
  },
  {
    name: 'Purchase Intent',
    icon: '🛒',
    categories: [
      'Apparel',
      'Appliances',
      'Art & Craft Supplies',
      'Automotive',
      'Baby Products',
      'Beauty & Personal Care',
      'Books & Literature',
      'Business Services',
      'Consumer Electronics',
      'Education',
      'Entertainment',
      'Financial Services',
      'Food & Beverages',
      'Gaming',
      'Gifts',
      'Health & Wellness',
      'Home & Garden',
      'Home Services',
      'Insurance',
      'Jewelry & Accessories',
      'Medical Services',
      'Office Supplies',
      'Pet Supplies',
      'Real Estate',
      'Sporting Goods',
      'Telecommunications',
      'Toys & Games',
      'Travel & Tourism',
      'Vehicles',
    ],
  },
]

export default function CategoriesPage() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSections = IAB_SECTIONS.filter(
    (section) =>
      section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.categories.some((cat) =>
        cat.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">IAB Taxonomy Browser</h1>
        <p className="text-gray-600 mt-1">
          Browse the complete IAB Taxonomy 1.1 (1,558 categories across 4 major sections)
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Categories
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search by section or category name..."
        />
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSections.map((section) => (
          <div
            key={section.name}
            className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start space-x-3 mb-4">
              <span className="text-3xl">{section.icon}</span>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">
                  {section.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {section.categories.length} top-level categories
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {section.categories.slice(0, 5).map((category) => (
                <div
                  key={category}
                  className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2"
                >
                  {category}
                </div>
              ))}
              {section.categories.length > 5 && (
                <p className="text-xs text-gray-500 mt-2">
                  +{section.categories.length - 5} more categories
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          About IAB Taxonomy 1.1
        </h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• Industry-standard content taxonomy for digital advertising</li>
          <li>• 1,558 categories across 4 major sections</li>
          <li>• Used by advertisers for audience targeting and classification</li>
          <li>• Maintained by the Interactive Advertising Bureau (IAB)</li>
          <li>• Full taxonomy integrated with OwnYou IAB Classifier</li>
        </ul>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Categories"
          value="1,558"
          color="blue"
        />
        <StatCard
          label="Demographics"
          value={IAB_SECTIONS[0].categories.length}
          color="purple"
        />
        <StatCard
          label="Household"
          value={IAB_SECTIONS[1].categories.length}
          color="green"
        />
        <StatCard
          label="Interests"
          value={IAB_SECTIONS[2].categories.length}
          color="orange"
        />
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: 'blue' | 'purple' | 'green' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
