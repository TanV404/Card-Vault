import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, initDb } from '../../../utils/db';

export async function GET() {
  try {
    await initDb();
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'cardvault_dev_secret_key_12345';
    let decoded;
    
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    const users = await sql`
      select id, email from users where id = ${userId}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User no longer exists' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { user: { id: users[0].id, email: users[0].email } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Session authentication error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
