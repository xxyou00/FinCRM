import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getSession, hashPassword } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role')
    const status = searchParams.get('status')

    const db = await getDatabase()
    const query: any = {}

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    if (role && role !== 'all') {
      query.role = role
    }

    if (status && status !== 'all') {
      query.status = status
    }

    const usersCollection = db.collection('users')
    const usersQuery = usersCollection.find(query, { projection: { password: 0 } })
    const users = await (usersQuery.sort ? usersQuery.sort({ createdAt: -1 }).toArray() : usersQuery.toArray())

    return NextResponse.json({
      users: users.map((user: any) => ({
        id: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status,
        lastLogin: user.lastLogin || user.createdAt,
        avatar: user.avatar || null,
      })),
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, password, firstName, lastName, role, department } = await request.json()

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const db = await getDatabase()
    
    const existingUser = await db.collection('users').findOne({ email })
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)

    const result = await db.collection('users').insertOne({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'User',
      department: department || 'General',
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({
      user: {
        id: result.insertedId.toString(),
        email,
        firstName,
        lastName,
        role: role || 'User',
        department: department || 'General',
        status: 'Active',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
