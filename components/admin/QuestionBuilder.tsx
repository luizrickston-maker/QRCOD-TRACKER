'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

export type QuestionType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'number'

export interface Question {
  id: string
  label: string
  type: QuestionType
  options?: string[]
  placeholder?: string
  required: boolean
  sort_order: number
}

const TYPE_LABELS: Record<QuestionType, string> = {
  text: '📝 Texto curto',
  email: '📧 E-mail',
  phone: '📱 Telefone',
  textarea: '📄 Texto longo',
  select: '📋 Lista (select)',
  radio: '⭕ Múltipla escolha',
  checkbox: '☑️ Checkboxes',
  number: '🔢 Número',
}

const HAS_OPTIONS: QuestionType[] = ['select', 'radio', 'checkbox']

interface SortableItemProps {
  question: Question
  onChange: (updated: Question) => void
  onRemove: () => void
  locked: boolean
}

function SortableItem({ question, onChange, onRemove, locked }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const [optionInput, setOptionInput] = useState('')
  const [expanded, setExpanded] = useState(true)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function addOption() {
    const val = optionInput.trim()
    if (!val) return
    onChange({
      ...question,
      options: [...(question.options ?? []), val],
    })
    setOptionInput('')
  }

  function removeOption(idx: number) {
    onChange({
      ...question,
      options: question.options?.filter((_, i) => i !== idx),
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700">
        {/* Drag handle */}
        {!locked && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0 touch-none"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        )}

        <span className="text-xs text-gray-500 font-medium flex-1 truncate">
          {question.label || 'Nova pergunta'}
        </span>

        <span className="text-xs text-gray-600 flex-shrink-0">
          {TYPE_LABELS[question.type]}
        </span>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-600 hover:text-gray-400 flex-shrink-0"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!locked && (
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-red-400 flex-shrink-0 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Pergunta</label>
            <input
              type="text"
              value={question.label}
              onChange={(e) => onChange({ ...question, label: e.target.value })}
              disabled={locked}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="Digite a pergunta..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
              <select
                value={question.type}
                onChange={(e) =>
                  onChange({ ...question, type: e.target.value as QuestionType, options: [] })
                }
                disabled={locked}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Placeholder */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Placeholder</label>
              <input
                type="text"
                value={question.placeholder ?? ''}
                onChange={(e) => onChange({ ...question, placeholder: e.target.value })}
                disabled={locked}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                placeholder="Texto de exemplo..."
              />
            </div>
          </div>

          {/* Obrigatório */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => onChange({ ...question, required: e.target.checked })}
              disabled={locked}
              className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-400">Campo obrigatório</span>
          </label>

          {/* Opções (para select/radio/checkbox) */}
          {HAS_OPTIONS.includes(question.type) && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Opções</label>
              <div className="space-y-1 mb-2">
                {(question.options ?? []).map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-300 bg-gray-900 px-2 py-1 rounded">
                      {opt}
                    </span>
                    {!locked && (
                      <button
                        onClick={() => removeOption(idx)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!locked && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                    className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    placeholder="Nova opção..."
                  />
                  <button
                    onClick={addOption}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface QuestionBuilderProps {
  questions: Question[]
  onChange: (questions: Question[]) => void
  locked: boolean
}

export default function QuestionBuilder({ questions, onChange, locked }: QuestionBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = questions.findIndex((q) => q.id === active.id)
      const newIdx = questions.findIndex((q) => q.id === over.id)
      onChange(arrayMove(questions, oldIdx, newIdx))
    }
  }

  function addQuestion() {
    const newQ: Question = {
      id: `new-${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      sort_order: questions.length,
    }
    onChange([...questions, newQ])
  }

  function updateQuestion(idx: number, updated: Question) {
    const next = [...questions]
    next[idx] = updated
    onChange(next)
  }

  function removeQuestion(idx: number) {
    onChange(questions.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {questions.map((q, idx) => (
            <SortableItem
              key={q.id}
              question={q}
              onChange={(updated) => updateQuestion(idx, updated)}
              onRemove={() => removeQuestion(idx)}
              locked={locked}
            />
          ))}
        </SortableContext>
      </DndContext>

      {!locked && (
        <button
          onClick={addQuestion}
          className="w-full py-2.5 border border-dashed border-gray-700 hover:border-blue-500 text-gray-500 hover:text-blue-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar pergunta
        </button>
      )}

      {questions.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-sm">
          Nenhuma pergunta ainda. Clique em "Adicionar pergunta".
        </div>
      )}
    </div>
  )
}
