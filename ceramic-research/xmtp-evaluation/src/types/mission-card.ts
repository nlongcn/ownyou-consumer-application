/**
 * MissionCard Types for OwnYou
 *
 * These types match the mission card structure defined in the research document
 * and align with OwnYou's mission agent architecture.
 */

export type MissionStatus = "ACTIVE" | "COMPLETED" | "DISMISSED";

export interface MissionStep {
  id: number;
  title: string;
  completed: boolean;
}

export interface MissionCard {
  missionId: string;
  title: string;
  status: MissionStatus;
  createdAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp
  steps: MissionStep[];
}

/**
 * Example mission card for testing
 */
export const exampleMissionCard: MissionCard = {
  missionId: "hawaii-trip-2025",
  title: "Plan Hawaii Vacation",
  status: "ACTIVE",
  createdAt: Date.now(),
  steps: [
    { id: 1, title: "Book flights", completed: false },
    { id: 2, title: "Book hotel", completed: false },
    { id: 3, title: "Plan activities", completed: false },
  ],
};
