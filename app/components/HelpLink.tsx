/**
 * HelpLink - Reusable component for linking to help topics
 */

import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

interface HelpLinkProps {
  /** The help topic ID to link to */
  topic: string;
  /** Optional title/tooltip text. Defaults to "Learn more about {topic}" */
  title?: string;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional icon size class. Defaults to "w-5 h-5" */
  iconSize?: string;
}

/**
 * A small help icon that links to a specific help topic.
 * Opens the help modal with the specified topic.
 */
export default function HelpLink({ 
  topic, 
  title, 
  className = '', 
  iconSize = 'w-5 h-5' 
}: HelpLinkProps) {
  const defaultTitle = title || `Learn more about ${topic}`;
  
  return (
    <Link 
      to={`help?topic=${topic}`}
      className={`cursor-pointer hover:text-white text-gray-400 ${className}`}
      title={defaultTitle}
    >
      <QuestionMarkCircleIcon className={iconSize} />
    </Link>
  );
}
