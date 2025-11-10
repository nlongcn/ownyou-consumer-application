export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Welcome to the Admin Dashboard
        </h2>
        <p className="text-gray-600 mb-4">
          This is the TypeScript-based admin dashboard for debugging IAB classifications
          and developing mission agents. Phase 1.5 - Week 1/4.
        </p>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ Next.js 14 Setup Complete
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ TypeScript IAB Classifier Integrated
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ IndexedDB Store Ready
          </span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Existing Features */}
        <FeatureCard
          title="Profile Viewer"
          description="View IAB classifications across 6 sections"
          href="/profile"
          status="complete"
        />
        <FeatureCard
          title="Analysis Runner"
          description="Run IAB classification on text input"
          href="/analyze"
          status="complete"
        />
        <FeatureCard
          title="Classifications List"
          description="Browse all IAB classifications"
          href="/classifications"
          status="complete"
        />

        {/* New Features */}
        <FeatureCard
          title="Category Browser"
          description="Browse IAB Taxonomy 1.1 structure"
          href="/categories"
          status="complete"
        />
        <FeatureCard
          title="Quality Analytics"
          description="Classification quality metrics"
          href="/quality"
          status="complete"
        />

        {/* Week 2-3 - Email Download & Classification */}
        <FeatureCard
          title="Email Download"
          description="Download emails from Gmail/Outlook with OAuth"
          href="/emails"
          status="complete"
        />
      </div>

      {/* Status Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📋 Phase 1.5 Progress (Week 1/4)
        </h3>
        <div className="space-y-2">
          <ProgressItem label="Strategic Roadmap Updated" completed />
          <ProgressItem label="Next.js Project Setup" completed />
          <ProgressItem label="Profile Viewer" completed />
          <ProgressItem label="Analysis Runner" completed />
          <ProgressItem label="Classifications List" completed />
          <ProgressItem label="Category Browser" completed />
          <ProgressItem label="Quality Analytics" completed />
          <ProgressItem label="End-to-End Testing" inProgress />
        </div>
      </div>

      {/* Documentation Links */}
      <div className="bg-gray-100 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          📚 Documentation
        </h3>
        <ul className="space-y-2">
          <li>
            <a
              href="/README.md"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Admin Dashboard README
            </a>
          </li>
          <li>
            <a
              href="/docs/plans/2025-01-04-ownyou-strategic-roadmap.md"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Strategic Roadmap (Phase 1.5)
            </a>
          </li>
          <li>
            <a
              href="/docs/learnings/ADMIN_DASHBOARD_TO_CONSUMER_UI.md"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Learnings Document (For Phase 5)
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

// Feature Card Component
function FeatureCard({
  title,
  description,
  href,
  status
}: {
  title: string
  description: string
  href: string
  status: 'migrating' | 'new' | 'complete'
}) {
  const statusStyles = {
    migrating: 'bg-yellow-100 text-yellow-800',
    new: 'bg-purple-100 text-purple-800',
    complete: 'bg-green-100 text-green-800',
  }

  const statusLabels = {
    migrating: '🔄 Migrating',
    new: '🆕 New',
    complete: '✅ Complete',
  }

  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </a>
  )
}

// Progress Item Component
function ProgressItem({
  label,
  completed = false,
  inProgress = false
}: {
  label: string
  completed?: boolean
  inProgress?: boolean
}) {
  return (
    <div className="flex items-center space-x-2">
      {completed ? (
        <span className="text-green-600">✅</span>
      ) : inProgress ? (
        <span className="text-yellow-600">🔄</span>
      ) : (
        <span className="text-gray-400">⏳</span>
      )}
      <span className={completed ? 'text-gray-700' : inProgress ? 'text-blue-700 font-medium' : 'text-gray-500'}>
        {label}
      </span>
    </div>
  )
}
