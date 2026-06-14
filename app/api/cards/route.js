import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, initDb } from '../../utils/db';

// Helper function to authenticate requests and get the user ID
async function authenticateRequest() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return { error: 'Not authenticated', status: 401 };
  }
  const jwtSecret = process.env.JWT_SECRET || 'cardvault_dev_secret_key_12345';
  try {
    const decoded = jwt.verify(token, jwtSecret);
    return { userId: decoded.userId };
  } catch {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

export async function GET() {
  try {
    await initDb();
    const auth = await authenticateRequest();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const cards = await sql`
      select id, person_name, company_name, designation, email, phone, address, created_at
      from cards
      where user_id = ${auth.userId}
      order by created_at desc
    `;

    return NextResponse.json({ cards }, { status: 200 });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initDb();
    const auth = await authenticateRequest();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { person_name, company_name, designation, email, phone, address } = body;

    if (!person_name || person_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters long' },
        { status: 400 }
      );
    }

    const [newCard] = await sql`
      insert into cards (user_id, person_name, company_name, designation, email, phone, address)
      values (${auth.userId}, ${person_name.trim()}, ${company_name?.trim() || null}, ${designation?.trim() || null}, ${email?.trim() || null}, ${phone?.trim() || null}, ${address?.trim() || null})
      returning id, person_name, company_name, designation, email, phone, address, created_at
    `;

    return NextResponse.json({ card: newCard, message: 'Card saved successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error saving card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
