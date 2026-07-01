import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, initDb } from '../../../utils/db';

export async function POST(request) {
  try {
    await initDb();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Normalizing email to lowercase
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUsers = await sql`
      select id from users where email = ${normalizedEmail}
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create the user
    const [newUser] = await sql`
      insert into users (email, password_hash)
      values (${normalizedEmail}, ${passwordHash})
      returning id, email
    `;

    // Sign JWT token
    const jwtSecret = process.env.JWT_SECRET || 'cardvault_dev_secret_key_12345';
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json(
      { user: { id: newUser.id, email: newUser.email }, message: 'Registration successful' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Signup error: ' + error.message },
      { status: 500 }
    );
  }
}
