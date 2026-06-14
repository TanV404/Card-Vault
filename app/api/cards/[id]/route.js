import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, initDb } from '../../../utils/db';

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

export async function PUT(request, { params }) {
  try {
    await initDb();
    const auth = await authenticateRequest();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Await params in Next.js 15+ and 16
    const { id } = await params;
    const cardId = parseInt(id, 10);

    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
    }

    const body = await request.json();
    const { person_name, company_name, designation, email, phone, address } = body;

    if (!person_name || person_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters long' },
        { status: 400 }
      );
    }

    const [updatedCard] = await sql`
      update cards
      set person_name = ${person_name.trim()},
          company_name = ${company_name?.trim() || null},
          designation = ${designation?.trim() || null},
          email = ${email?.trim() || null},
          phone = ${phone?.trim() || null},
          address = ${address?.trim() || null}
      where id = ${cardId} and user_id = ${auth.userId}
      returning id, person_name, company_name, designation, email, phone, address, created_at
    `;

    if (!updatedCard) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ card: updatedCard, message: 'Card updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await initDb();
    const auth = await authenticateRequest();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Await params in Next.js 15+ and 16
    const { id } = await params;
    const cardId = parseInt(id, 10);

    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
    }

    const [deletedCard] = await sql`
      delete from cards
      where id = ${cardId} and user_id = ${auth.userId}
      returning id
    `;

    if (!deletedCard) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Card deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
