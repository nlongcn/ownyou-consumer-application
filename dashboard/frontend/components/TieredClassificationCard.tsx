/**
 * Tiered Classification Card Component
 *
 * Displays a single classification group with primary and alternative classifications.
 * Shows granularity scores, confidence levels, and confidence deltas for alternatives.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GranularityScoreBadge } from "./GranularityScoreBadge"
import { ConfidenceDeltaBadge } from "./ConfidenceDeltaBadge"
import type { TieredGroup } from "@/types/profile"

interface TieredClassificationCardProps {
  group: TieredGroup
  fieldName: string
}

export function TieredClassificationCard({
  group,
  fieldName
}: TieredClassificationCardProps) {
  const { primary, alternatives, selection_method } = group

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">
            {fieldName.replace(/_/g, ' ')}
          </CardTitle>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Primary
          </span>
        </div>
        <CardDescription className="text-xs">
          {primary.tier_path}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Primary Classification */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{primary.value}</span>
            <span className="text-sm text-muted-foreground font-medium">
              {(primary.confidence * 100).toFixed(1)}%
            </span>
          </div>

          {/* Confidence Bar */}
          <div className="w-full bg-secondary rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all"
              style={{ width: `${primary.confidence * 100}%` }}
            />
          </div>

          {/* Granularity Score and Metadata */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Granularity:</span>
              <GranularityScoreBadge score={primary.granularity_score} />
            </div>
            <span className="text-muted-foreground text-xs">
              Tier {primary.tier_depth}
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            {primary.evidence_count} evidence item{primary.evidence_count !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Alternative Classifications */}
        {alternatives.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Alternatives ({alternatives.length})
            </p>
            <div className="space-y-2">
              {alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md bg-secondary/30"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{alt.value}</div>
                    <div className="text-xs text-muted-foreground">
                      {alt.evidence_count} evidence
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {(alt.confidence * 100).toFixed(1)}%
                    </span>
                    <ConfidenceDeltaBadge delta={alt.confidence_delta} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selection Method */}
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Method:</span>{' '}
            <span className="capitalize">
              {selection_method.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
