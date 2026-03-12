import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export async function GET() {
  try {
    const hasMongoUri = !!process.env.MONGODB_URI
    const mongoUri = process.env.MONGODB_URI ? 
      process.env.MONGODB_URI.substring(0, 30) + '...' : 
      'not set'
    
    const db = await getDatabase()
    const users = await db.collection('users').find({}).toArray()
    
    return NextResponse.json({
      status: 'success',
      hasMongoUri,
      mongoUriPrefix: mongoUri,
      userCount: users.length,
      message: 'Database connection successful'
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      hasMongoUri: !!process.env.MONGODB_URI,
      mongoUriPrefix: process.env.MONGODB_URI ? 
        process.env.MONGODB_URI.substring(0, 30) + '...' : 
        'not set',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
