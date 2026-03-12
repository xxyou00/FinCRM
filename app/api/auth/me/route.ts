import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

// 兼容 MongoDB ObjectId 和字符串 ID
function toObjectId(id: string) {
  try {
    const { ObjectId } = require('mongodb')
    return new ObjectId(id)
  } catch {
    return id
  }
}

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = await getDatabase()
    const user = await db.collection('users').findOne(
      { _id: toObjectId(session.id) },
      { projection: { password: 0 } }
    )

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
