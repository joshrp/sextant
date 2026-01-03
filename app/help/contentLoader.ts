/**
 * Content loader for help topics
 * This module handles dynamic loading of MDX content files
 */

// Import all MDX files eagerly to avoid dynamic import issues

import * as IntroductionContent from './content/introduction.mdx';
import * as RecyclingContent from './content/recycling.mdx';
import * as PlaceholderContent from './content/placeholder.mdx';

import * as GoalsContent from './content/goals.mdx';
import * as BalancerContent from './content/balancer.mdx';
import * as ScoringContent from './content/scoring.mdx';
import * as ManifoldsContent from './content/manifolds.mdx';


// Map topic IDs to their content components


export const contentMap = {
  introduction: IntroductionContent.default,
  recycling: RecyclingContent.default,
  placeholder: PlaceholderContent.default,
  goals: GoalsContent.default,
  balancer: BalancerContent.default,
  scoring: ScoringContent.default,
  manifolds: ManifoldsContent.default,
} as const;

/**
 * Load content component for a topic
 * Returns the placeholder if the topic doesn't have content yet
 */
export function loadContent(topicId: keyof typeof contentMap) {
  return contentMap[topicId] || PlaceholderContent.default;
}
