import { isAuthed } from "@/lib/gowin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return Response.json({ authed: await isAuthed() })
}
