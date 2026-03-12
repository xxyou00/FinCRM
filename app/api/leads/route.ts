import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const db = await getDatabase()
    const query: any = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    if (status && status !== 'all') {
      query.status = status
    }

    if (priority && priority !== 'all') {
      query.priority = priority
    }

    const leadsCollection = db.collection('leads')
    const leadsQuery = leadsCollection.find(query)
    const leads = await (leadsQuery.sort ? leadsQuery.sort({ createdAt: -1 }).toArray() : leadsQuery.toArray())

    return NextResponse.json({
      leads: leads.map((lead: any) => ({
        id: lead._id.toString(),
        name: lead.name,
        contact: lead.contact,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        value: lead.value,
        assignedTo: lead.assignedTo,
        createdAt: lead.createdAt,
        lastContact: lead.lastContact,
        notes: lead.notes,
      })),
    })
  } catch (error) {
    console.error('Get leads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, contact, email, phone, source, priority, value, notes } = data

    if (!name || !contact || !email) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    const db = await getDatabase()
    const result = await db.collection('leads').insertOne({
      name,
      contact,
      email,
      phone: phone || '',
      source: source || 'Website',
      status: 'New',
      priority: priority || 'Medium',
      value: value || 0,
      assignedTo: `${session.firstName} ${session.lastName}`,
      notes: notes || '',
      createdAt: new Date(),
      lastContact: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({
      lead: {
        id: result.insertedId.toString(),
        name,
        contact,
        email,
        status: 'New',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create lead error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
