import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { hashPassword, createToken, setSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, company } = await request.json()

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user
    const result = await db.collection('users').insertOne({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      company: company || '',
      role: 'User',
      status: 'Active',
      department: 'General',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const token = await createToken({
      id: result.insertedId.toString(),
      email,
      firstName,
      lastName,
      role: 'User',
    })

    await setSession(token)

    return NextResponse.json({
      user: {
        id: result.insertedId.toString(),
        email,
        firstName,
        lastName,
        company: company || '',
        role: 'User',
      },
      token,
    }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
