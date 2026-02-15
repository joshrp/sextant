import { CloseButton, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'

type SelectorDialogProps = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  title?: string
  children?: React.ReactNode,
  widthClassName?: string,
  heightClassName?: string,
}

export function SelectorDialog({ 
  isOpen, setIsOpen, title, children,
  widthClassName = "min-w-20",
  heightClassName = "max-h-[90vh]",
}: SelectorDialogProps) {

  return <Dialog open={isOpen} onClose={setIsOpen} className="">
    <DialogBackdrop className="fixed z-2000 inset-0 bg-gray-500/75 transition-opacity data-open:opacity-60 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in" />
    <div className="fixed flex inset-x-0 top-12 z-2000">
      <DialogPanel className={`
        m-auto grid grid-rows-[min-content_1fr] 
        ${widthClassName} ${heightClassName}        
        bg-gray-100 dark:bg-gray-800 
        transition-opacity data-open:opacity-100 data-closed:opacity-0 
        data-enter:duration-2000 data-enter:ease-out data-leave:duration-200 
        data-leave:ease-in text-center sm:items-center sm:p-0`}>
        <div className="w-full flex items-center justify-between mb-2 p-2 border-b-2 border-gray-300 dark:border-gray-700 relative texture-embossed">
          <div className="flex-1" />
          <DialogTitle className="flex-6">
            {title}
          </DialogTitle>
          <CloseButton className="flex-1 text-right cursor-pointer">
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </CloseButton>
        </div>
        <div className="p-2 overflow-y-auto h-full">
          {children}
        </div>
      </DialogPanel>
    </div>
  </Dialog>
}
