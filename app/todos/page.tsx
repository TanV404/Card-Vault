import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Todo List (Supabase Test)</h1>
      <ul className="space-y-2">
        {todos?.map((todo) => (
          <li key={todo.id} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
            {todo.name}
          </li>
        ))}
        {(!todos || todos.length === 0) && (
          <p className="text-gray-500 text-sm">No todos found or "todos" table does not exist yet.</p>
        )}
      </ul>
    </div>
  )
}
