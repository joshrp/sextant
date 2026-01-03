/**
 * HelpHub - Full-screen help modal with MDX content
 */

import { Dialog, DialogBackdrop, DialogPanel, CloseButton } from '@headlessui/react';
import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'react-router';
import { MDXProvider } from '@mdx-js/react';
import { HelpProvider, useHelp } from './HelpContext';
import { helpCategories, getTopicsByCategory, getTopicById, type HelpTopic } from './helpMetadata';
import { FactoryContext } from '~/factory/FactoryContext';
import { contentMap, loadContent } from './contentLoader';

interface HelpHubProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MDX component overrides for consistent styling - aligned with app zinc/gray theme
 */
const mdxComponents = {
  // Headings
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-4xl font-bold mb-6 mt-8 text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-300 dark:border-zinc-700 pb-2" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-3xl font-semibold mb-4 mt-6 text-zinc-800 dark:text-zinc-200" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-2xl font-semibold mb-3 mt-4 text-zinc-800 dark:text-zinc-200" {...props} />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="text-xl font-medium mb-2 mt-3 text-zinc-700 dark:text-zinc-300" {...props} />
  ),

  // Paragraphs and text
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />
  ),

  // Lists
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside mb-4 space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="ml-4 p-2" {...props} />
  ),

  // Links
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-blue-600 dark:text-blue-400 hover:underline" {...props} />
  ),

  // Code
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded text-sm font-mono" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto mb-4" {...props} />
  ),

  // Blockquotes
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-zinc-600 dark:text-zinc-400" {...props} />
  ),

  // Images - enforced consistent sizing
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img className="max-w-full h-auto rounded-lg shadow-md my-4 mx-auto" {...props} />
  ),

  // Tables
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <table className="min-w-full divide-y divide-zinc-300 dark:divide-zinc-700 mb-4" {...props} />
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-zinc-100 dark:bg-zinc-800" {...props} />
  ),
  tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300" {...props} />
  ),

  // Horizontal rule
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-8 border-t-2 border-zinc-300 dark:border-zinc-700" {...props} />
  ),

  // Strong and emphasis
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold text-zinc-900 dark:text-zinc-100" {...props} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic" {...props} />
  ),
};

function HelpHubContent({ isOpen, onClose }: HelpHubProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const { factoryStore } = useHelp();

  const topicId = searchParams.get('topic') || 'introduction';

  const currentTopic = getTopicById(topicId);
  const topicsByCategory = getTopicsByCategory();

  // Handle hash-based navigation to sections
  useEffect(() => {
    // Check if there's a hash in the URL after topic change
    if (window.location.hash && contentRef.current) {
      // Small delay to let content render
      const timer = setTimeout(() => {
        const targetId = window.location.hash.slice(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement && contentRef.current) {
          // Scroll to the element within the modal
          const modalTop = contentRef.current.getBoundingClientRect().top;
          const elementTop = targetElement.getBoundingClientRect().top;
          const scrollPosition = elementTop - modalTop + contentRef.current.scrollTop - 20; // 20px padding
          
          contentRef.current.scrollTo({
            top: scrollPosition,
            behavior: 'smooth',
          });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [topicId]);

  const selectTopic = (topic: HelpTopic) => {
    const newParams = new URLSearchParams();
    newParams.set('topic', topic.id);
    setSearchParams(newParams);
    // Clear hash when changing topics
    window.location.hash = '';
  };

  type keys = keyof typeof contentMap;

  function isValidTopicId<T extends string>(topicId: T): topicId is T extends keys ? T : never {
    if (topicId in contentMap === false) {
      throw new Error(`Help topic "${topicId}" does not have associated content.`);
    }
    return true;
  };

  const ContentComponent = currentTopic ? isValidTopicId(currentTopic?.id) && loadContent(currentTopic.id) : null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-5000">
      <DialogBackdrop className="fixed inset-0 bg-black/60" />

      <div className="fixed inset-0 overflow-hidden">
        <DialogPanel className="h-[90vh] w-[90vw] m-auto mt-[5vh] bg-white dark:bg-zinc-900 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Captains Manual
              </h1>
            </div>
            <CloseButton className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded">
              <XMarkIcon className="w-6 h-6" />
            </CloseButton>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            {sidebarOpen && (
              <aside className="w-64 border-r border-zinc-300 dark:border-zinc-700 overflow-y-auto bg-zinc-50 dark:bg-zinc-800 p-4">
                {helpCategories
                  .sort((a, b) => (a.order || 999) - (b.order || 999))
                  .map(category => {
                    const topics = topicsByCategory.get(category.id) || [];
                    if (topics.length === 0) return null;

                    return (
                      <div key={category.id} className="mb-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400 mb-2">
                          {category.title}
                        </h3>
                        <ul className="space-y-1">
                          {topics.map(topic => (
                            <li key={topic.id}>
                              <button
                                onClick={() => selectTopic(topic)}
                                className={`w-full text-left px-3 py-2 rounded transition ${topic.id === topicId
                                  ? 'bg-blue-500 text-white'
                                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                  }`}
                              >
                                {topic.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </aside>
            )}

            {/* Content area */}
            <main
              ref={contentRef}
              className="flex-1 overflow-y-auto p-8"
            >
              <div className="max-w-4xl mx-auto">
                {currentTopic && ContentComponent && factoryStore && (
                  <MDXProvider components={mdxComponents}>
                    <FactoryContext.Provider
                      value={{
                        store: factoryStore.Graph,
                        historical: factoryStore.Historical,
                        id: '__help_example_factory__',
                        name: 'Help Example Factory',
                      }}
                    >
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="text-zinc-500">Loading content...</div>
                        </div>
                      }>
                        <ContentComponent components={mdxComponents} />
                      </Suspense>
                    </FactoryContext.Provider>
                  </MDXProvider>
                )}

                {!currentTopic && (
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Topic Not Found</h2>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      The requested help topic could not be found.
                    </p>
                  </div>
                )}
              </div>
            </main>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default function HelpHub(props: HelpHubProps) {
  return (
    <HelpProvider>
      <HelpHubContent {...props} />
    </HelpProvider>
  );
}
