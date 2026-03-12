import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'

async function seedDatabase() {
  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db('fincrm')

    // Clear existing data
    await db.collection('users').deleteMany({})
    await db.collection('leads').deleteMany({})
    console.log('Cleared existing data')

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    await db.collection('users').insertMany([
      {
        email: 'xingxiang@itiger.com',
        password: hashedPassword,
        firstName: 'Xing',
        lastName: 'Xiang',
        company: 'iTiger',
        role: 'Admin',
        department: 'Management',
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'alice@fincrm.com',
        password: hashedPassword,
        firstName: 'Alice',
        lastName: 'Johnson',
        company: 'FinCRM Inc.',
        role: 'Sales Manager',
        department: 'Sales',
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'bob@fincrm.com',
        password: hashedPassword,
        firstName: 'Bob',
        lastName: 'Smith',
        company: 'FinCRM Inc.',
        role: 'Risk Analyst',
        department: 'Risk Management',
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    console.log('Created users')

    // Create sample leads
    await db.collection('leads').insertMany([
      {
        name: 'TechCorp Inc.',
        contact: 'John Smith',
        email: 'john@techcorp.com',
        phone: '+1 (555) 123-4567',
        source: 'Website',
        status: 'New',
        priority: 'High',
        value: 250000,
        assignedTo: 'Alice Johnson',
        notes: 'Interested in enterprise solution',
        createdAt: new Date('2024-01-15'),
        lastContact: new Date('2024-01-15'),
        updatedAt: new Date(),
      },
      {
        name: 'Global Solutions Ltd.',
        contact: 'Sarah Davis',
        email: 'sarah@globalsolutions.com',
        phone: '+1 (555) 234-5678',
        source: 'Referral',
        status: 'Qualified',
        priority: 'Medium',
        value: 180000,
        assignedTo: 'Bob Smith',
        notes: 'Follow up on proposal',
        createdAt: new Date('2024-01-14'),
        lastContact: new Date('2024-01-16'),
        updatedAt: new Date(),
      },
      {
        name: 'Innovation Partners',
        contact: 'Mike Johnson',
        email: 'mike@innovation.com',
        phone: '+1 (555) 345-6789',
        source: 'Cold Call',
        status: 'Proposal',
        priority: 'High',
        value: 320000,
        assignedTo: 'Alice Johnson',
        notes: 'Proposal sent, awaiting response',
        createdAt: new Date('2024-01-13'),
        lastContact: new Date('2024-01-17'),
        updatedAt: new Date(),
      },
    ])
    console.log('Created leads')

    console.log('Database seeded successfully!')
    console.log('\nDemo credentials:')
    console.log('Email: xingxiang@itiger.com')
    console.log('Password: admin123')
  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    await client.close()
  }
}

seedDatabase()
