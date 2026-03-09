/**
 * Content loader for help topics
 * This module handles dynamic loading of MDX content files
 */

// Import all MDX files eagerly to avoid dynamic import issues

import * as IntroductionContent from './content/introduction.mdx';
import * as RecyclingContent from './content/recycling.mdx';
import * as GoalsContent from './content/goals.mdx';
import * as BalancerContent from './content/balancer.mdx';
import * as ScoringContent from './content/scoring.mdx';
import * as ManifoldsContent from './content/manifolds.mdx';
import * as SettlementsContent from './content/settlements.mdx';
import * as ImportExportContent from './content/import-export.mdx';
import * as YourDataContent from './content/your-data.mdx';
import * as ContractsContent from './content/contracts.mdx';
import * as BugsContent from './content/bugs.mdx';


// Map topic IDs to their content components


export const contentMap = {
  introduction: IntroductionContent.default,
  recycling: RecyclingContent.default,
  goals: GoalsContent.default,
  balancer: BalancerContent.default,
  scoring: ScoringContent.default,
  manifolds: ManifoldsContent.default,
  settlements: SettlementsContent.default,
  'import-export': ImportExportContent.default,
  'your-data': YourDataContent.default,
  contracts: ContractsContent.default,
  bugs: BugsContent.default,
} as const;

/**
 * Load content component for a topic
 * Returns the placeholder if the topic doesn't have content yet
 */
export function loadContent(topicId: keyof typeof contentMap) {
  return contentMap[topicId];
}
