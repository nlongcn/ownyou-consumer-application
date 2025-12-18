import { BUILD_INFO } from '../build-info';

interface VersionBadgeProps {
  /** Show full details including git info */
  detailed?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Displays app version and build timestamp
 * Shows in bottom-right corner or wherever placed
 */
export function VersionBadge({ detailed = false, className = '' }: VersionBadgeProps) {
  if (detailed) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        <div className="font-mono">
          v{BUILD_INFO.version} ({BUILD_INFO.gitBranch}@{BUILD_INFO.gitCommit})
        </div>
        <div>Built: {BUILD_INFO.buildDate}</div>
      </div>
    );
  }

  return (
    <div className={`text-xs font-mono bg-black/70 text-white px-2 py-1 rounded ${className}`}>
      v{BUILD_INFO.version}
    </div>
  );
}
