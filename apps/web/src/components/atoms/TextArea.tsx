import type { ComponentProps } from 'react'

export function TextArea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} className={`field ${props.className ?? ''}`.trim()} />
}
